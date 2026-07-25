import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ReceiverStatus, SizingMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { Actor, isSuper, ownedBy } from '../common/scope';
import { COPIER_PROVIDER, CopierProvider, SymbolMap } from '../copier/copier.types';
import { CreateCopierDto, UpdateCopierDto } from './dto/copier.dto';
import { AddReceiverDto, UpdateReceiverDto } from './dto/receiver.dto';
import { SymbolMapDto } from './dto/symbol-map.dto';

const SUB_VIEW = {
  id: true,
  copierConfigId: true,
  receiverAccountId: true,
  sizingMode: true,
  multiplier: true,
  copySl: true,
  copyTp: true,
  reverse: true,
  symbolMapping: true,
  enabled: true,
  status: true,
  createdAt: true,
  receiverAccount: {
    select: { id: true, label: true, login: true, server: true, platform: true, status: true },
  },
} satisfies Prisma.SubscriptionSelect;

const COPIER_VIEW = {
  id: true,
  name: true,
  sourceAccountId: true,
  copyfactoryStrategyId: true,
  enabled: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  sourceAccount: {
    select: { id: true, label: true, login: true, server: true, platform: true, status: true },
  },
  _count: { select: { subscriptions: true } },
} satisfies Prisma.CopierConfigSelect;

const COPIER_DETAIL = {
  ...COPIER_VIEW,
  subscriptions: { select: SUB_VIEW, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.CopierConfigSelect;

export type CopierView = Prisma.CopierConfigGetPayload<{ select: typeof COPIER_VIEW }>;
export type SubscriptionView = Prisma.SubscriptionGetPayload<{ select: typeof SUB_VIEW }>;

@Injectable()
export class CopiersService {
  private readonly logger = new Logger(CopiersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    @Inject(COPIER_PROVIDER) private readonly copier: CopierProvider,
  ) {}

  private get maxCopiers(): number {
    return this.config.get<number>('MAX_COPIERS', 2);
  }
  private get maxReceivers(): number {
    return this.config.get<number>('MAX_RECEIVERS_PER_COPIER', 10);
  }

  private static normalizeMapping(mapping?: SymbolMapDto[]): SymbolMap[] | undefined {
    return mapping?.map((m) => ({ from: m.from, to: m.to }));
  }

  /** Subscription ownership filter (via its parent copier config). */
  private subScope(actor: Actor): Record<string, unknown> {
    return isSuper(actor) ? {} : { copierConfig: { createdById: actor.sub } };
  }

  // -------- Configs --------
  listConfigs(actor: Actor): Promise<CopierView[]> {
    return this.prisma.copierConfig.findMany({
      where: ownedBy(actor),
      select: COPIER_VIEW,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getConfig(id: string, actor: Actor) {
    const config = await this.prisma.copierConfig.findFirst({
      where: { id, ...ownedBy(actor) },
      select: COPIER_DETAIL,
    });
    if (!config) throw new NotFoundException('Copier not found');
    return config;
  }

  async createConfig(dto: CreateCopierDto, actor: Actor): Promise<CopierView> {
    const actorId = actor.sub;
    const count = await this.prisma.copierConfig.count({ where: ownedBy(actor) });
    if (count >= this.maxCopiers) {
      throw new ConflictException(`Copier limit reached (max ${this.maxCopiers}).`);
    }

    const source = await this.prisma.account.findFirst({
      where: { id: dto.sourceAccountId, ...ownedBy(actor), deletedAt: null },
    });
    if (!source) throw new NotFoundException('Source account not found');

    const existing = await this.prisma.copierConfig.findUnique({
      where: { sourceAccountId: dto.sourceAccountId },
    });
    if (existing) {
      throw new ConflictException('This account is already a source in another copier.');
    }

    const { strategyId } = await this.copier.createStrategy({
      metaapiAccountId: source.metaapiAccountId,
      name: dto.name,
    });

    try {
      const config = await this.prisma.copierConfig.create({
        data: {
          name: dto.name,
          sourceAccountId: dto.sourceAccountId,
          copyfactoryStrategyId: strategyId,
          createdById: actorId,
        },
        select: COPIER_VIEW,
      });
      await this.audit.log({
        userId: actorId,
        action: 'COPIER_CREATED',
        entityType: 'CopierConfig',
        entityId: config.id,
        meta: { name: config.name, sourceAccountId: dto.sourceAccountId },
      });
      return config;
    } catch (err) {
      await this.safeRemoveStrategy(strategyId);
      throw err;
    }
  }

  async updateConfig(id: string, dto: UpdateCopierDto, actor: Actor): Promise<CopierView> {
    const actorId = actor.sub;
    const config = await this.prisma.copierConfig.findFirst({
      where: { id, ...ownedBy(actor) },
      include: { subscriptions: true },
    });
    if (!config) throw new NotFoundException('Copier not found');

    if (dto.enabled !== undefined && dto.enabled !== config.enabled) {
      for (const sub of config.subscriptions) {
        if (dto.enabled && sub.enabled) {
          await this.copier.resumeSubscription(sub.copyfactorySubscriberId);
        } else if (!dto.enabled) {
          await this.copier.pauseSubscription(sub.copyfactorySubscriberId);
        }
      }
    }

    const updated = await this.prisma.copierConfig.update({
      where: { id },
      data: { name: dto.name, enabled: dto.enabled },
      select: COPIER_VIEW,
    });
    await this.audit.log({
      userId: actorId,
      action: 'COPIER_UPDATED',
      entityType: 'CopierConfig',
      entityId: id,
    });
    return updated;
  }

  async deleteConfig(id: string, actor: Actor): Promise<void> {
    const actorId = actor.sub;
    const config = await this.prisma.copierConfig.findFirst({
      where: { id, ...ownedBy(actor) },
      include: { subscriptions: true },
    });
    if (!config) throw new NotFoundException('Copier not found');

    for (const sub of config.subscriptions) {
      await this.safeRemoveSubscriber(sub.copyfactorySubscriberId);
    }
    await this.safeRemoveStrategy(config.copyfactoryStrategyId);
    await this.prisma.copierConfig.delete({ where: { id } });
    await this.audit.log({
      userId: actorId,
      action: 'COPIER_DELETED',
      entityType: 'CopierConfig',
      entityId: id,
    });
  }

  async closeAll(id: string, actor: Actor): Promise<{ closed: number }> {
    const actorId = actor.sub;
    const config = await this.prisma.copierConfig.findFirst({
      where: { id, ...ownedBy(actor) },
      include: { sourceAccount: true, subscriptions: { include: { receiverAccount: true } } },
    });
    if (!config) throw new NotFoundException('Copier not found');

    await this.copier.closeAll(config.sourceAccount.metaapiAccountId);
    for (const sub of config.subscriptions) {
      await this.copier.closeAll(sub.receiverAccount.metaapiAccountId);
    }
    await this.audit.log({
      userId: actorId,
      action: 'COPIER_CLOSE_ALL',
      entityType: 'CopierConfig',
      entityId: id,
      meta: { receivers: config.subscriptions.length },
    });
    return { closed: config.subscriptions.length + 1 };
  }

  // -------- Receivers (subscriptions) --------
  async addReceiver(
    configId: string,
    dto: AddReceiverDto,
    actor: Actor,
  ): Promise<SubscriptionView> {
    const actorId = actor.sub;
    const config = await this.prisma.copierConfig.findFirst({
      where: { id: configId, ...ownedBy(actor) },
    });
    if (!config) throw new NotFoundException('Copier not found');

    if (dto.receiverAccountId === config.sourceAccountId) {
      throw new BadRequestException('The source account cannot also be a receiver.');
    }

    const receiver = await this.prisma.account.findFirst({
      where: { id: dto.receiverAccountId, ...ownedBy(actor), deletedAt: null },
    });
    if (!receiver) throw new NotFoundException('Receiver account not found');

    const count = await this.prisma.subscription.count({ where: { copierConfigId: configId } });
    if (count >= this.maxReceivers) {
      throw new ConflictException(`Receiver limit reached (max ${this.maxReceivers}).`);
    }

    const dup = await this.prisma.subscription.findUnique({
      where: {
        copierConfigId_receiverAccountId: {
          copierConfigId: configId,
          receiverAccountId: dto.receiverAccountId,
        },
      },
    });
    if (dup) throw new ConflictException('This account is already a receiver in this copier.');

    const rules = {
      sizingMode: dto.sizingMode ?? SizingMode.MULTIPLIER,
      multiplier: dto.multiplier ?? 1,
      reverse: dto.reverse ?? false,
      copySl: dto.copySl ?? true,
      copyTp: dto.copyTp ?? true,
      symbolMapping: CopiersService.normalizeMapping(dto.symbolMapping),
    };

    const { subscriberId } = await this.copier.addSubscriber({
      slaveMetaapiAccountId: receiver.metaapiAccountId,
      strategyId: config.copyfactoryStrategyId,
      ...rules,
    });

    try {
      const sub = await this.prisma.subscription.create({
        data: {
          copierConfigId: configId,
          receiverAccountId: dto.receiverAccountId,
          copyfactorySubscriberId: subscriberId,
          sizingMode: dto.sizingMode ?? SizingMode.MULTIPLIER,
          multiplier: rules.multiplier,
          copySl: rules.copySl,
          copyTp: rules.copyTp,
          reverse: rules.reverse,
          symbolMapping: rules.symbolMapping
            ? (rules.symbolMapping as unknown as Prisma.InputJsonValue)
            : undefined,
          status: ReceiverStatus.ACTIVE,
        },
        select: SUB_VIEW,
      });
      await this.audit.log({
        userId: actorId,
        action: 'RECEIVER_ADDED',
        entityType: 'Subscription',
        entityId: sub.id,
        meta: { configId, receiverAccountId: dto.receiverAccountId },
      });
      return sub;
    } catch (err) {
      await this.safeRemoveSubscriber(subscriberId);
      throw err;
    }
  }

  async updateReceiver(
    subId: string,
    dto: UpdateReceiverDto,
    actor: Actor,
  ): Promise<SubscriptionView> {
    const actorId = actor.sub;
    const existing = await this.prisma.subscription.findFirst({
      where: { id: subId, ...this.subScope(actor) },
    });
    if (!existing) throw new NotFoundException('Receiver not found');

    const mapping = CopiersService.normalizeMapping(dto.symbolMapping);
    const sub = await this.prisma.subscription.update({
      where: { id: subId },
      data: {
        sizingMode: dto.sizingMode,
        multiplier: dto.multiplier,
        copySl: dto.copySl,
        copyTp: dto.copyTp,
        reverse: dto.reverse,
        symbolMapping: mapping
          ? (mapping as unknown as Prisma.InputJsonValue)
          : undefined,
        enabled: dto.enabled,
        ...(dto.enabled !== undefined
          ? { status: dto.enabled ? ReceiverStatus.ACTIVE : ReceiverStatus.PAUSED }
          : {}),
      },
      select: SUB_VIEW,
    });

    await this.copier.updateSubscriber(existing.copyfactorySubscriberId, {
      sizingMode: dto.sizingMode,
      multiplier: dto.multiplier,
      reverse: dto.reverse,
      copySl: dto.copySl,
      copyTp: dto.copyTp,
      symbolMapping: mapping,
      enabled: dto.enabled,
    });
    await this.audit.log({
      userId: actorId,
      action: 'RECEIVER_UPDATED',
      entityType: 'Subscription',
      entityId: subId,
    });
    return sub;
  }

  async setReceiverEnabled(
    subId: string,
    enabled: boolean,
    actor: Actor,
  ): Promise<SubscriptionView> {
    const actorId = actor.sub;
    const existing = await this.prisma.subscription.findFirst({
      where: { id: subId, ...this.subScope(actor) },
    });
    if (!existing) throw new NotFoundException('Receiver not found');

    if (enabled) await this.copier.resumeSubscription(existing.copyfactorySubscriberId);
    else await this.copier.pauseSubscription(existing.copyfactorySubscriberId);

    const sub = await this.prisma.subscription.update({
      where: { id: subId },
      data: { enabled, status: enabled ? ReceiverStatus.ACTIVE : ReceiverStatus.PAUSED },
      select: SUB_VIEW,
    });
    await this.audit.log({
      userId: actorId,
      action: enabled ? 'RECEIVER_RESUMED' : 'RECEIVER_PAUSED',
      entityType: 'Subscription',
      entityId: subId,
    });
    return sub;
  }

  async removeReceiver(subId: string, actor: Actor): Promise<void> {
    const actorId = actor.sub;
    const sub = await this.prisma.subscription.findFirst({
      where: { id: subId, ...this.subScope(actor) },
    });
    if (!sub) throw new NotFoundException('Receiver not found');

    await this.safeRemoveSubscriber(sub.copyfactorySubscriberId);
    await this.prisma.subscription.delete({ where: { id: subId } });
    await this.audit.log({
      userId: actorId,
      action: 'RECEIVER_REMOVED',
      entityType: 'Subscription',
      entityId: subId,
    });
  }

  private async safeRemoveStrategy(strategyId: string): Promise<void> {
    try {
      await this.copier.removeStrategy(strategyId);
    } catch (e) {
      this.logger.warn(`cleanup removeStrategy failed: ${(e as Error).message}`);
    }
  }
  private async safeRemoveSubscriber(subscriberId: string): Promise<void> {
    try {
      await this.copier.removeSubscriber(subscriberId);
    } catch (e) {
      this.logger.warn(`cleanup removeSubscriber failed: ${(e as Error).message}`);
    }
  }
}
