import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, SizingMode, SlaveStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CryptoService } from '../common/crypto/crypto.service';
import {
  COPIER_PROVIDER,
  CopierProvider,
  SymbolMap,
} from '../copier/copier.types';
import { CreateSlaveDto } from './dto/create-slave.dto';
import { UpdateSlaveDto } from './dto/update-slave.dto';
import { SymbolMapDto } from './dto/symbol-map.dto';

const SLAVE_VIEW = {
  id: true,
  masterAccountId: true,
  label: true,
  metaapiAccountId: true,
  copyfactorySubscriberId: true,
  login: true,
  server: true,
  platform: true,
  sizingMode: true,
  multiplier: true,
  copySl: true,
  copyTp: true,
  reverse: true,
  symbolMapping: true,
  riskLimits: true,
  enabled: true,
  status: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SlaveAccountSelect;

export type SlaveView = Prisma.SlaveAccountGetPayload<{
  select: typeof SLAVE_VIEW;
}>;

@Injectable()
export class SlavesService {
  private readonly logger = new Logger(SlavesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly crypto: CryptoService,
    private readonly config: ConfigService,
    @Inject(COPIER_PROVIDER) private readonly copier: CopierProvider,
  ) {}

  private get maxSlaves(): number {
    return this.config.get<number>('MAX_SLAVES_PER_MASTER', 10);
  }

  private static normalizeMapping(
    mapping?: SymbolMapDto[],
  ): SymbolMap[] | undefined {
    return mapping?.map((m) => ({ from: m.from, to: m.to }));
  }

  async create(
    masterId: string,
    dto: CreateSlaveDto,
    actorId: string,
  ): Promise<SlaveView> {
    const master = await this.prisma.masterAccount.findUnique({
      where: { id: masterId },
    });
    if (!master) throw new NotFoundException('Master account not found');

    const count = await this.prisma.slaveAccount.count({
      where: { masterAccountId: masterId },
    });
    if (count >= this.maxSlaves) {
      throw new ConflictException(
        `Slave limit reached for this master (max ${this.maxSlaves}).`,
      );
    }

    const rules = {
      multiplier: dto.multiplier ?? 1,
      reverse: dto.reverse ?? false,
      copySl: dto.copySl ?? true,
      copyTp: dto.copyTp ?? true,
      symbolMapping: SlavesService.normalizeMapping(dto.symbolMapping),
    };

    const { metaapiAccountId } = await this.copier.provisionAccount({
      name: dto.label,
      login: dto.login,
      password: dto.password,
      server: dto.server,
      platform: dto.platform,
    });
    const { subscriberId } = await this.copier.addSubscriber({
      slaveMetaapiAccountId: metaapiAccountId,
      strategyId: master.copyfactoryStrategyId,
      ...rules,
    });

    try {
      const slave = await this.prisma.slaveAccount.create({
        data: {
          masterAccountId: masterId,
          label: dto.label,
          metaapiAccountId,
          copyfactorySubscriberId: subscriberId,
          login: dto.login,
          server: dto.server,
          platform: dto.platform,
          encryptedPassword: this.crypto.encrypt(dto.password),
          sizingMode: dto.sizingMode ?? SizingMode.MULTIPLIER,
          multiplier: rules.multiplier,
          copySl: rules.copySl,
          copyTp: rules.copyTp,
          reverse: rules.reverse,
          symbolMapping: rules.symbolMapping
            ? (rules.symbolMapping as unknown as Prisma.InputJsonValue)
            : undefined,
          enabled: true,
          status: SlaveStatus.COPYING,
          createdById: actorId,
        },
        select: SLAVE_VIEW,
      });
      await this.audit.log({
        userId: actorId,
        action: 'SLAVE_CREATED',
        entityType: 'SlaveAccount',
        entityId: slave.id,
        meta: { masterId, label: slave.label },
      });
      return slave;
    } catch (err) {
      await this.safeRemoveSubscriber(subscriberId);
      await this.safeRemoveAccount(metaapiAccountId);
      throw err;
    }
  }

  async listForMaster(masterId: string): Promise<SlaveView[]> {
    const master = await this.prisma.masterAccount.findUnique({
      where: { id: masterId },
      select: { id: true },
    });
    if (!master) throw new NotFoundException('Master account not found');
    return this.prisma.slaveAccount.findMany({
      where: { masterAccountId: masterId },
      select: SLAVE_VIEW,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<SlaveView> {
    const slave = await this.prisma.slaveAccount.findUnique({
      where: { id },
      select: SLAVE_VIEW,
    });
    if (!slave) throw new NotFoundException('Slave account not found');
    return slave;
  }

  async update(
    id: string,
    dto: UpdateSlaveDto,
    actorId: string,
  ): Promise<SlaveView> {
    const existing = await this.prisma.slaveAccount.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Slave account not found');

    const mapping = SlavesService.normalizeMapping(dto.symbolMapping);
    const slave = await this.prisma.slaveAccount.update({
      where: { id },
      data: {
        label: dto.label,
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
          ? { status: dto.enabled ? SlaveStatus.COPYING : SlaveStatus.PAUSED }
          : {}),
      },
      select: SLAVE_VIEW,
    });

    await this.copier.updateSubscriber(existing.copyfactorySubscriberId, {
      multiplier: dto.multiplier,
      reverse: dto.reverse,
      copySl: dto.copySl,
      copyTp: dto.copyTp,
      symbolMapping: mapping,
      enabled: dto.enabled,
    });
    await this.audit.log({
      userId: actorId,
      action: 'SLAVE_UPDATED',
      entityType: 'SlaveAccount',
      entityId: id,
    });
    return slave;
  }

  async setEnabled(
    id: string,
    enabled: boolean,
    actorId: string,
  ): Promise<SlaveView> {
    const existing = await this.prisma.slaveAccount.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Slave account not found');

    if (enabled) {
      await this.copier.resumeSubscription(existing.copyfactorySubscriberId);
    } else {
      await this.copier.pauseSubscription(existing.copyfactorySubscriberId);
    }

    const slave = await this.prisma.slaveAccount.update({
      where: { id },
      data: {
        enabled,
        status: enabled ? SlaveStatus.COPYING : SlaveStatus.PAUSED,
      },
      select: SLAVE_VIEW,
    });
    await this.audit.log({
      userId: actorId,
      action: enabled ? 'SLAVE_RESUMED' : 'SLAVE_PAUSED',
      entityType: 'SlaveAccount',
      entityId: id,
    });
    return slave;
  }

  async remove(id: string, actorId: string): Promise<void> {
    const slave = await this.prisma.slaveAccount.findUnique({ where: { id } });
    if (!slave) throw new NotFoundException('Slave account not found');

    await this.safeRemoveSubscriber(slave.copyfactorySubscriberId);
    await this.safeRemoveAccount(slave.metaapiAccountId);
    await this.prisma.slaveAccount.delete({ where: { id } });
    await this.audit.log({
      userId: actorId,
      action: 'SLAVE_DELETED',
      entityType: 'SlaveAccount',
      entityId: id,
    });
  }

  private async safeRemoveAccount(metaapiAccountId: string): Promise<void> {
    try {
      await this.copier.removeAccount(metaapiAccountId);
    } catch (e) {
      this.logger.warn(`cleanup removeAccount failed: ${(e as Error).message}`);
    }
  }

  private async safeRemoveSubscriber(subscriberId: string): Promise<void> {
    try {
      await this.copier.removeSubscriber(subscriberId);
    } catch (e) {
      this.logger.warn(
        `cleanup removeSubscriber failed: ${(e as Error).message}`,
      );
    }
  }
}
