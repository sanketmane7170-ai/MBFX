import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { COPIER_PROVIDER, CopierProvider } from '../copier/copier.types';
import { CreateAccountDto } from './dto/account.dto';

const ACCOUNT_VIEW = {
  id: true,
  label: true,
  metaapiAccountId: true,
  login: true,
  server: true,
  platform: true,
  status: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  sourceForConfig: { select: { id: true, name: true } },
  _count: { select: { receiverSubscriptions: true } },
} satisfies Prisma.AccountSelect;

export type AccountView = Prisma.AccountGetPayload<{ select: typeof ACCOUNT_VIEW }>;

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly crypto: CryptoService,
    private readonly config: ConfigService,
    @Inject(COPIER_PROVIDER) private readonly copier: CopierProvider,
  ) {}

  private get maxAccounts(): number {
    return this.config.get<number>('MAX_ACCOUNTS', 50);
  }

  async create(dto: CreateAccountDto, actorId: string): Promise<AccountView> {
    const count = await this.prisma.account.count();
    if (count >= this.maxAccounts) {
      throw new ConflictException(`Account limit reached (max ${this.maxAccounts}).`);
    }

    const { metaapiAccountId } = await this.copier.provisionAccount({
      name: dto.label,
      login: dto.login,
      password: dto.password,
      server: dto.server,
      platform: dto.platform,
    });

    try {
      const account = await this.prisma.account.create({
        data: {
          label: dto.label,
          metaapiAccountId,
          login: dto.login,
          server: dto.server,
          platform: dto.platform,
          encryptedPassword: this.crypto.encrypt(dto.password),
          status: AccountStatus.CONNECTED,
          createdById: actorId,
        },
        select: ACCOUNT_VIEW,
      });
      await this.audit.log({
        userId: actorId,
        action: 'ACCOUNT_CREATED',
        entityType: 'Account',
        entityId: account.id,
        meta: { label: account.label, login: account.login },
      });
      return account;
    } catch (err) {
      await this.safeRemoveAccount(metaapiAccountId);
      throw err;
    }
  }

  findAll(): Promise<AccountView[]> {
    return this.prisma.account.findMany({
      select: ACCOUNT_VIEW,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<AccountView> {
    const account = await this.prisma.account.findUnique({
      where: { id },
      select: ACCOUNT_VIEW,
    });
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  async rename(id: string, label: string, actorId: string): Promise<AccountView> {
    await this.findOne(id);
    const account = await this.prisma.account.update({
      where: { id },
      data: { label },
      select: ACCOUNT_VIEW,
    });
    await this.audit.log({
      userId: actorId,
      action: 'ACCOUNT_RENAMED',
      entityType: 'Account',
      entityId: id,
    });
    return account;
  }

  async setConnected(id: string, connected: boolean, actorId: string): Promise<AccountView> {
    await this.findOne(id);
    const account = await this.prisma.account.update({
      where: { id },
      data: {
        status: connected ? AccountStatus.CONNECTED : AccountStatus.DISCONNECTED,
      },
      select: ACCOUNT_VIEW,
    });
    await this.audit.log({
      userId: actorId,
      action: connected ? 'ACCOUNT_CONNECTED' : 'ACCOUNT_DISCONNECTED',
      entityType: 'Account',
      entityId: id,
    });
    return account;
  }

  async remove(id: string, actorId: string): Promise<void> {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: {
        sourceForConfig: { include: { subscriptions: true } },
        receiverSubscriptions: true,
      },
    });
    if (!account) throw new NotFoundException('Account not found');

    // Tear down CopyFactory: this account's own config (as source) + any place it is a receiver.
    if (account.sourceForConfig) {
      for (const sub of account.sourceForConfig.subscriptions) {
        await this.safeRemoveSubscriber(sub.copyfactorySubscriberId);
      }
      await this.safeRemoveStrategy(account.sourceForConfig.copyfactoryStrategyId);
    }
    for (const sub of account.receiverSubscriptions) {
      await this.safeRemoveSubscriber(sub.copyfactorySubscriberId);
    }
    await this.safeRemoveAccount(account.metaapiAccountId);

    await this.prisma.account.delete({ where: { id } }); // cascades config + subscriptions
    await this.audit.log({
      userId: actorId,
      action: 'ACCOUNT_DELETED',
      entityType: 'Account',
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
