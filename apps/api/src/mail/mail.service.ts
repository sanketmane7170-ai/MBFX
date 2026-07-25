import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { SettingsService, SmtpConfig } from '../settings/settings.service';

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

  constructor(private readonly settings: SettingsService) {}

  isConfigured(): boolean {
    return this.settings.hasSmtp();
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
}
