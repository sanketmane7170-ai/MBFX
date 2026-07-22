import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MasterStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { COPIER_PROVIDER, CopierProvider } from '../copier/copier.types';
import { CreateMasterDto } from './dto/create-master.dto';

const MASTER_VIEW = {
  id: true,
  label: true,
  metaapiAccountId: true,
  copyfactoryStrategyId: true,
  login: true,
  server: true,
  platform: true,
  status: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { slaves: true } },
} satisfies Prisma.MasterAccountSelect;

export type MasterView = Prisma.MasterAccountGetPayload<{
  select: typeof MASTER_VIEW;
}>;

@Injectable()
export class MastersService {
  private readonly logger = new Logger(MastersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly crypto: CryptoService,
    private readonly config: ConfigService,
    @Inject(COPIER_PROVIDER) private readonly copier: CopierProvider,
  ) {}

  private get maxMasters(): number {
    return this.config.get<number>('MAX_MASTER_ACCOUNTS', 2);
  }

  async create(dto: CreateMasterDto, actorId: string): Promise<MasterView> {
    const count = await this.prisma.masterAccount.count();
    if (count >= this.maxMasters) {
      throw new ConflictException(
        `Master account limit reached (max ${this.maxMasters}).`,
      );
    }

    // 1) Provision the MT connection + 2) create its CopyFactory strategy.
    const { metaapiAccountId } = await this.copier.provisionAccount({
      name: dto.label,
      login: dto.login,
      password: dto.password,
      server: dto.server,
      platform: dto.platform,
    });
    const { strategyId } = await this.copier.createStrategy({
      metaapiAccountId,
      name: dto.label,
    });

    // 3) Persist (password encrypted). Roll back the provider on failure.
    try {
      const master = await this.prisma.masterAccount.create({
        data: {
          label: dto.label,
          metaapiAccountId,
          copyfactoryStrategyId: strategyId,
          login: dto.login,
          server: dto.server,
          platform: dto.platform,
          encryptedPassword: this.crypto.encrypt(dto.password),
          status: MasterStatus.CONNECTED,
          createdById: actorId,
        },
        select: MASTER_VIEW,
      });
      await this.audit.log({
        userId: actorId,
        action: 'MASTER_CREATED',
        entityType: 'MasterAccount',
        entityId: master.id,
        meta: { label: master.label, login: master.login },
      });
      return master;
    } catch (err) {
      await this.safeCleanup(strategyId, metaapiAccountId);
      throw err;
    }
  }

  findAll(): Promise<MasterView[]> {
    return this.prisma.masterAccount.findMany({
      select: MASTER_VIEW,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<MasterView> {
    const master = await this.prisma.masterAccount.findUnique({
      where: { id },
      select: MASTER_VIEW,
    });
    if (!master) throw new NotFoundException('Master account not found');
    return master;
  }

  async rename(
    id: string,
    label: string,
    actorId: string,
  ): Promise<MasterView> {
    await this.findOne(id);
    const master = await this.prisma.masterAccount.update({
      where: { id },
      data: { label },
      select: MASTER_VIEW,
    });
    await this.audit.log({
      userId: actorId,
      action: 'MASTER_RENAMED',
      entityType: 'MasterAccount',
      entityId: id,
    });
    return master;
  }

  async setConnected(
    id: string,
    connected: boolean,
    actorId: string,
  ): Promise<MasterView> {
    await this.findOne(id);
    const master = await this.prisma.masterAccount.update({
      where: { id },
      data: {
        status: connected
          ? MasterStatus.CONNECTED
          : MasterStatus.DISCONNECTED,
      },
      select: MASTER_VIEW,
    });
    await this.audit.log({
      userId: actorId,
      action: connected ? 'MASTER_CONNECTED' : 'MASTER_DISCONNECTED',
      entityType: 'MasterAccount',
      entityId: id,
    });
    return master;
  }

  async closeAll(id: string, actorId: string): Promise<{ closed: number }> {
    const master = await this.prisma.masterAccount.findUnique({
      where: { id },
      include: { slaves: true },
    });
    if (!master) throw new NotFoundException('Master account not found');

    await this.copier.closeAll(master.metaapiAccountId);
    for (const slave of master.slaves) {
      await this.copier.closeAll(slave.metaapiAccountId);
    }
    await this.audit.log({
      userId: actorId,
      action: 'MASTER_CLOSE_ALL',
      entityType: 'MasterAccount',
      entityId: id,
      meta: { slaves: master.slaves.length },
    });
    return { closed: master.slaves.length + 1 };
  }

  async remove(id: string, actorId: string): Promise<void> {
    const master = await this.prisma.masterAccount.findUnique({
      where: { id },
      include: { slaves: true },
    });
    if (!master) throw new NotFoundException('Master account not found');

    // Tear down slaves' subscriptions + accounts, then the master's strategy + account.
    for (const slave of master.slaves) {
      await this.safeRemoveSubscriber(slave.copyfactorySubscriberId);
      await this.safeRemoveAccount(slave.metaapiAccountId);
    }
    await this.safeCleanup(master.copyfactoryStrategyId, master.metaapiAccountId);

    // Cascade deletes slave rows via the FK relation.
    await this.prisma.masterAccount.delete({ where: { id } });
    await this.audit.log({
      userId: actorId,
      action: 'MASTER_DELETED',
      entityType: 'MasterAccount',
      entityId: id,
      meta: { slaves: master.slaves.length },
    });
  }

  private async safeCleanup(
    strategyId: string,
    metaapiAccountId: string,
  ): Promise<void> {
    try {
      await this.copier.removeStrategy(strategyId);
    } catch (e) {
      this.logger.warn(`cleanup removeStrategy failed: ${(e as Error).message}`);
    }
    await this.safeRemoveAccount(metaapiAccountId);
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
