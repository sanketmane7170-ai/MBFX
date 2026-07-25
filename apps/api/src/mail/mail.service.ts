import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role, UserStatus } from '@prisma/client';
import { createTransport, type Transporter } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService, SmtpConfig } from '../settings/settings.service';
import { copyAlertEmail, inviteEmail, passwordResetLinkEmail, resetEmail } from './templates';

export interface MailInput {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export interface MailResult {
  ok: boolean;
  message: string;
}

/** Details for a failed-copy alert email. */
export interface CopyAlertInput {
  receiverAccountId: string;
  sourceAccountId: string;
  symbol: string;
  side: string;
  lots: number | string;
  action: string;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'unknown error';
}

/**
 * Outbound email via SMTP (nodemailer). Configuration comes from SettingsService
 * (DB, encrypted) with env fallback. The transporter is cached and rebuilt only
 * when the underlying SMTP config changes.
 *
 * `send()` is best-effort and never throws — email must never break the action
 * that triggered it (admin invite, password reset, copy alerts).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private cached: { signature: string; transporter: Transporter } | null = null;

  // Copy-alert throttle: last-sent time per dedupe key, to avoid inbox floods.
  private readonly alertThrottle = new Map<string, number>();
  private readonly ALERT_WINDOW_MS = 5 * 60 * 1000;

  constructor(
    private readonly settings: SettingsService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  isConfigured(): boolean {
    return this.settings.hasSmtp();
  }

  private appUrl(): string | null {
    const u = this.config.get<string>('APP_URL');
    return u && u.trim().length > 0 ? u.replace(/\/+$/, '') : null;
  }

  private signature(cfg: SmtpConfig): string {
    return [cfg.host, cfg.port, cfg.secure, cfg.user, cfg.password].join('|');
  }

  private transportFor(cfg: SmtpConfig): Transporter {
    const sig = this.signature(cfg);
    if (this.cached && this.cached.signature === sig) return this.cached.transporter;
    const transporter = createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.password },
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    this.cached = { signature: sig, transporter };
    return transporter;
  }

  private fromAddress(cfg: SmtpConfig): string {
    const email = cfg.fromEmail || cfg.user;
    return cfg.fromName ? `"${cfg.fromName}" <${email}>` : email;
  }

  /** Verifies the SMTP connection/credentials for the given (or stored) config. */
  async verify(cfg?: SmtpConfig | null): Promise<MailResult> {
    const c = cfg ?? this.settings.getSmtpConfig();
    if (!c) return { ok: false, message: 'No SMTP configuration set.' };
    try {
      await this.transportFor(c).verify();
      return { ok: true, message: `Connected to ${c.host}:${c.port} as ${c.user}.` };
    } catch (e) {
      return { ok: false, message: 'SMTP connection failed: ' + errMsg(e) };
    }
  }

  /** Sends using an explicit config — used by the Settings "test email" flow. */
  async sendWith(cfg: SmtpConfig, input: MailInput): Promise<MailResult> {
    try {
      const info = await this.transportFor(cfg).sendMail({
        from: this.fromAddress(cfg),
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
      return { ok: true, message: `Email sent to ${input.to} (id ${info.messageId}).` };
    } catch (e) {
      return { ok: false, message: 'Send failed: ' + errMsg(e) };
    }
  }

  /** Best-effort send using the stored config. Never throws. */
  async send(input: MailInput): Promise<MailResult> {
    const cfg = this.settings.getSmtpConfig();
    if (!cfg) {
      this.logger.warn(`SMTP not configured — skipping "${input.subject}" to ${input.to}`);
      return { ok: false, message: 'SMTP not configured.' };
    }
    const r = await this.sendWith(cfg, input);
    if (!r.ok) this.logger.error(`Email "${input.subject}" to ${input.to} failed: ${r.message}`);
    return r;
  }

  // ---------------------------------------------------------------------------
  // Application emails (Phase 2 & 3). All best-effort — never throw.
  // ---------------------------------------------------------------------------

  /** New-admin invite with temporary credentials. */
  async sendAdminInvite(email: string, tempPassword: string): Promise<MailResult> {
    const { subject, html, text } = inviteEmail({ email, password: tempPassword, url: this.appUrl() });
    return this.send({ to: email, subject, html, text });
  }

  /** Notice that a super-admin reset this admin's password. */
  async sendPasswordResetNotice(email: string, newPassword: string): Promise<MailResult> {
    const { subject, html, text } = resetEmail({ email, password: newPassword, url: this.appUrl() });
    return this.send({ to: email, subject, html, text });
  }

  /** Self-service reset: a link to choose a new password. */
  async sendPasswordResetLink(email: string, token: string, expiresMinutes: number): Promise<MailResult> {
    const base = this.appUrl();
    const resetUrl = `${base ?? ''}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
    const { subject, html, text } = passwordResetLinkEmail({
      email,
      url: base,
      resetUrl,
      expiresMinutes,
    });
    return this.send({ to: email, subject, html, text });
  }

  /** Recipients for copy alerts: configured alertEmail, else all active super-admins. */
  private async alertRecipients(): Promise<string[]> {
    const cfg = this.settings.getSmtpConfig();
    if (cfg?.alertEmail) return [cfg.alertEmail];
    const admins = await this.prisma.user.findMany({
      where: { role: Role.SUPER_ADMIN, status: UserStatus.ACTIVE },
      select: { email: true },
    });
    return admins.map((a) => a.email);
  }

  /**
   * Fire-and-forget alert on a failed copy. Skips when email/alerts are off, and
   * throttles per receiver+symbol so a broker outage can't flood the inbox.
   */
  async sendCopyAlert(evt: CopyAlertInput): Promise<void> {
    const cfg = this.settings.getSmtpConfig();
    if (!cfg || !cfg.alertsEnabled) return;

    const key = `${evt.receiverAccountId}|${evt.symbol}|${evt.side}`;
    const now = Date.now();
    const last = this.alertThrottle.get(key) ?? 0;
    if (now - last < this.ALERT_WINDOW_MS) return;
    this.alertThrottle.set(key, now);

    try {
      const recipients = await this.alertRecipients();
      if (recipients.length === 0) return;

      const accounts = await this.prisma.account.findMany({
        where: { id: { in: [evt.sourceAccountId, evt.receiverAccountId] } },
        select: { id: true, label: true, login: true },
      });
      const label = (id: string) => {
        const a = accounts.find((x) => x.id === id);
        return a ? `${a.label} (#${a.login})` : id;
      };
      const source = label(evt.sourceAccountId);
      const receiver = label(evt.receiverAccountId);
      const order = `${evt.side} ${evt.lots} ${evt.symbol} (${evt.action})`;

      const { subject, html, text } = copyAlertEmail({
        order,
        master: source,
        slave: receiver,
        url: this.appUrl(),
      });
      await this.send({ to: recipients.join(', '), subject, html, text });
    } catch (e) {
      this.logger.error('Failed to send copy alert: ' + errMsg(e));
    }
  }
}
