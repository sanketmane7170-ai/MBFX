import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformSetting } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { SetSmtpDto, TestSmtpDto } from './dto/update-settings.dto';

const SINGLETON = 'singleton';

export interface MetaApiStatus {
  configured: boolean;
  region: string;
  tokenPreview: string | null;
  source: 'settings' | 'env' | 'none';
  updatedAt: string | null;
}

/** Full SMTP config including the decrypted password — never leaves the server. */
export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromName: string | null;
  fromEmail: string | null;
  alertEmail: string | null;
  alertsEnabled: boolean;
}

/** Safe SMTP view for the client — no password. */
export interface SmtpStatus {
  configured: boolean;
  host: string | null;
  port: number | null;
  secure: boolean;
  user: string | null;
  fromName: string | null;
  fromEmail: string | null;
  alertEmail: string | null;
  alertsEnabled: boolean;
  source: 'settings' | 'env' | 'none';
  updatedAt: string | null;
}

function maskToken(t: string): string {
  if (t.length <= 12) return '••••';
  return `${t.slice(0, 6)}…${t.slice(-4)}`;
}

/**
 * Platform settings: the operator's MetaApi token and the outbound email (SMTP)
 * configuration. Secrets (MetaApi token, SMTP password) are AES-256-GCM encrypted
 * at rest and cached in memory. Each falls back to env vars when nothing is stored.
 */
@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);

  private token: string | null = null;
  private region = 'new-york';

  private smtp: SmtpConfig | null = null;
  private smtpSource: 'settings' | 'env' | 'none' = 'none';
  private smtpUpdatedAt: Date | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  private async reload(): Promise<void> {
    const row = await this.prisma.platformSetting.findUnique({
      where: { id: SINGLETON },
    });
    this.loadMetaApi(row);
    this.loadSmtp(row);
  }

  // ---------------------------------------------------------------------------
  // MetaApi
  // ---------------------------------------------------------------------------
  private loadMetaApi(row: PlatformSetting | null): void {
    if (row?.metaapiTokenEncrypted) {
      try {
        this.token = this.crypto.decrypt(row.metaapiTokenEncrypted);
        this.region = row.metaapiRegion;
        return;
      } catch {
        this.logger.error('Failed to decrypt stored MetaApi token');
      }
    }
    const envToken = this.config.get<string>('METAAPI_TOKEN');
    this.token = envToken && envToken.trim().length > 0 ? envToken : null;
    this.region = this.config.get<string>('METAAPI_REGION', 'new-york');
  }

  getToken(): string | null {
    return this.token;
  }
  getRegion(): string {
    return this.region;
  }
  hasToken(): boolean {
    return !!this.token;
  }

  async getStatus(): Promise<MetaApiStatus> {
    const row = await this.prisma.platformSetting.findUnique({
      where: { id: SINGLETON },
    });
    const source: MetaApiStatus['source'] = row?.metaapiTokenEncrypted
      ? 'settings'
      : this.token
        ? 'env'
        : 'none';
    return {
      configured: this.hasToken(),
      region: this.region,
      tokenPreview: this.token ? maskToken(this.token) : null,
      source,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
    };
  }

  async setMetaApi(token: string, region: string, userId: string): Promise<MetaApiStatus> {
    const encrypted = this.crypto.encrypt(token);
    await this.prisma.platformSetting.upsert({
      where: { id: SINGLETON },
      update: { metaapiTokenEncrypted: encrypted, metaapiRegion: region, updatedById: userId },
      create: {
        id: SINGLETON,
        metaapiTokenEncrypted: encrypted,
        metaapiRegion: region,
        updatedById: userId,
      },
    });
    this.token = token;
    this.region = region;
    return this.getStatus();
  }

  async clear(userId: string): Promise<MetaApiStatus> {
    await this.prisma.platformSetting.upsert({
      where: { id: SINGLETON },
      update: { metaapiTokenEncrypted: null, updatedById: userId },
      create: { id: SINGLETON },
    });
    await this.reload();
    return this.getStatus();
  }

  /**
   * Validates a token against MetaApi by making a lightweight authenticated call.
   * Uses the provided token or the stored one. Never persists.
   */
  async testConnection(
    token?: string,
    region?: string,
  ): Promise<{ ok: boolean; message: string; accounts?: number }> {
    const t = token ?? this.token;
    const r = region ?? this.region;
    if (!t) return { ok: false, message: 'No MetaApi token configured.' };

    try {
      // Loose typing: the SDK is validated live, not at compile time.
      const mod: any = await import('metaapi.cloud-sdk');
      const MetaApi = mod.default ?? mod;
      const api = new MetaApi(t, { region: r });
      const accApi = api.metatraderAccountApi;
      const accounts =
        (await accApi.getAccountsWithInfiniteScrollPagination?.()) ??
        (await accApi.getAccountsWithClassicPagination?.()) ??
        (await accApi.getAccounts?.());
      const count = Array.isArray(accounts)
        ? accounts.length
        : (accounts?.items?.length ?? accounts?.count ?? 0);
      return {
        ok: true,
        message: `Token valid — ${count} MetaTrader account(s) in this MetaApi profile.`,
        accounts: count,
      };
    } catch (e) {
      return {
        ok: false,
        message:
          'MetaApi rejected the token or the connection failed: ' +
          (e instanceof Error ? e.message : 'unknown error'),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // SMTP / email
  // ---------------------------------------------------------------------------
  private loadSmtp(row: PlatformSetting | null): void {
    if (row?.smtpHost && row.smtpUser && row.smtpPasswordEncrypted && row.smtpPort) {
      try {
        this.smtp = {
          host: row.smtpHost,
          port: row.smtpPort,
          secure: row.smtpSecure,
          user: row.smtpUser,
          password: this.crypto.decrypt(row.smtpPasswordEncrypted),
          fromName: row.smtpFromName,
          fromEmail: row.smtpFromEmail,
          alertEmail: row.alertEmail,
          alertsEnabled: row.alertsEnabled,
        };
        this.smtpSource = 'settings';
        this.smtpUpdatedAt = row.smtpUpdatedAt ?? row.updatedAt;
        return;
      } catch {
        this.logger.error('Failed to decrypt stored SMTP password');
      }
    }

    // Env fallback.
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const password = this.config.get<string>('SMTP_PASSWORD');
    if (host && user && password) {
      this.smtp = {
        host,
        port: Number(this.config.get<string>('SMTP_PORT', '587')) || 587,
        secure: this.config.get<string>('SMTP_SECURE', 'false') === 'true',
        user,
        password,
        fromName: this.config.get<string>('SMTP_FROM_NAME') ?? null,
        fromEmail: this.config.get<string>('SMTP_FROM_EMAIL') ?? null,
        alertEmail: this.config.get<string>('ALERT_EMAIL') ?? null,
        alertsEnabled: this.config.get<string>('ALERTS_ENABLED', 'true') !== 'false',
      };
      this.smtpSource = 'env';
      this.smtpUpdatedAt = null;
      return;
    }

    this.smtp = null;
    this.smtpSource = 'none';
    this.smtpUpdatedAt = null;
  }

  /** Full config (with password) for the mailer. */
  getSmtpConfig(): SmtpConfig | null {
    return this.smtp;
  }
  hasSmtp(): boolean {
    return !!this.smtp;
  }

  getSmtpStatus(): SmtpStatus {
    return {
      configured: !!this.smtp,
      host: this.smtp?.host ?? null,
      port: this.smtp?.port ?? null,
      secure: this.smtp?.secure ?? false,
      user: this.smtp?.user ?? null,
      fromName: this.smtp?.fromName ?? null,
      fromEmail: this.smtp?.fromEmail ?? null,
      alertEmail: this.smtp?.alertEmail ?? null,
      alertsEnabled: this.smtp?.alertsEnabled ?? true,
      source: this.smtpSource,
      updatedAt: this.smtpUpdatedAt?.toISOString() ?? null,
    };
  }

  async setSmtp(dto: SetSmtpDto, userId: string): Promise<SmtpStatus> {
    const existing = await this.prisma.platformSetting.findUnique({
      where: { id: SINGLETON },
    });
    let encrypted = existing?.smtpPasswordEncrypted ?? null;
    if (dto.password && dto.password.length > 0) {
      encrypted = this.crypto.encrypt(dto.password);
    }
    if (!encrypted) {
      throw new BadRequestException('SMTP password is required.');
    }

    const data = {
      smtpHost: dto.host,
      smtpPort: dto.port,
      smtpSecure: dto.secure ?? false,
      smtpUser: dto.user,
      smtpPasswordEncrypted: encrypted,
      smtpFromName: dto.fromName ?? null,
      smtpFromEmail: dto.fromEmail ?? null,
      alertEmail: dto.alertEmail ?? null,
      alertsEnabled: dto.alertsEnabled ?? true,
      smtpUpdatedAt: new Date(),
      updatedById: userId,
    };
    await this.prisma.platformSetting.upsert({
      where: { id: SINGLETON },
      update: data,
      create: { id: SINGLETON, ...data },
    });
    await this.reload();
    return this.getSmtpStatus();
  }

  async clearSmtp(userId: string): Promise<SmtpStatus> {
    await this.prisma.platformSetting.upsert({
      where: { id: SINGLETON },
      update: {
        smtpHost: null,
        smtpPort: null,
        smtpUser: null,
        smtpPasswordEncrypted: null,
        smtpFromName: null,
        smtpFromEmail: null,
        smtpUpdatedAt: null,
        updatedById: userId,
      },
      create: { id: SINGLETON },
    });
    await this.reload();
    return this.getSmtpStatus();
  }

  /**
   * Builds a full config for a test send by layering request overrides over the
   * stored config (falling back to the stored password when one isn't supplied).
   */
  resolveSmtpForTest(dto: TestSmtpDto): SmtpConfig | null {
    const base = this.smtp;
    const host = dto.host ?? base?.host;
    const port = dto.port ?? base?.port;
    const user = dto.user ?? base?.user;
    const password = dto.password && dto.password.length > 0 ? dto.password : base?.password;
    if (!host || !port || !user || !password) return null;
    return {
      host,
      port,
      secure: dto.secure ?? base?.secure ?? false,
      user,
      password,
      fromName: dto.fromName ?? base?.fromName ?? null,
      fromEmail: dto.fromEmail ?? base?.fromEmail ?? null,
      alertEmail: base?.alertEmail ?? null,
      alertsEnabled: base?.alertsEnabled ?? true,
    };
  }
}
