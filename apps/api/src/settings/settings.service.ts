import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';

const SINGLETON = 'singleton';

export interface MetaApiStatus {
  configured: boolean;
  region: string;
  tokenPreview: string | null;
  source: 'settings' | 'env' | 'none';
  updatedAt: string | null;
}

function maskToken(t: string): string {
  if (t.length <= 12) return '••••';
  return `${t.slice(0, 6)}…${t.slice(-4)}`;
}

/**
 * Platform settings, primarily the operator's MetaApi token.
 * Token is AES-256-GCM encrypted at rest and cached in memory for the copier
 * provider. Falls back to the METAAPI_TOKEN env var when nothing is stored.
 */
@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);
  private token: string | null = null;
  private region = 'new-york';

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

  // ---- used by the copier provider ----
  getToken(): string | null {
    return this.token;
  }
  getRegion(): string {
    return this.region;
  }
  hasToken(): boolean {
    return !!this.token;
  }

  // ---- admin API ----
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
}
