import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditService } from '../common/audit/audit.service';
import { MailService } from '../mail/mail.service';
import { SettingsService } from './settings.service';
import {
  SetMetaApiDto,
  SetSmtpDto,
  TestConnectionDto,
  TestSmtpDto,
} from './dto/update-settings.dto';

// Super-admin only.
@Controller('settings')
@Roles(Role.SUPER_ADMIN)
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  // ---- MetaApi ----
  @Get('metaapi')
  status() {
    return this.settings.getStatus();
  }

  @Put('metaapi')
  async set(@Body() dto: SetMetaApiDto, @CurrentUser('sub') userId: string) {
    const status = await this.settings.setMetaApi(dto.token, dto.region ?? 'new-york', userId);
    await this.audit.log({
      userId,
      action: 'METAAPI_TOKEN_SET',
      entityType: 'PlatformSetting',
      entityId: 'singleton',
      meta: { region: status.region },
    });
    return status;
  }

  @Post('metaapi/test')
  @HttpCode(HttpStatus.OK)
  test(@Body() dto: TestConnectionDto) {
    return this.settings.testConnection(dto.token, dto.region);
  }

  @Delete('metaapi')
  async clear(@CurrentUser('sub') userId: string) {
    const status = await this.settings.clear(userId);
    await this.audit.log({
      userId,
      action: 'METAAPI_TOKEN_CLEARED',
      entityType: 'PlatformSetting',
      entityId: 'singleton',
    });
    return status;
  }

  // ---- SMTP / email ----
  @Get('smtp')
  smtpStatus() {
    return this.settings.getSmtpStatus();
  }

  @Put('smtp')
  async setSmtp(@Body() dto: SetSmtpDto, @CurrentUser('sub') userId: string) {
    const status = await this.settings.setSmtp(dto, userId);
    await this.audit.log({
      userId,
      action: 'SMTP_CONFIG_SET',
      entityType: 'PlatformSetting',
      entityId: 'singleton',
      meta: { host: status.host, port: status.port, user: status.user },
    });
    return status;
  }

  @Post('smtp/test')
  @HttpCode(HttpStatus.OK)
  async smtpTest(@Body() dto: TestSmtpDto, @CurrentUser('sub') userId: string) {
    const cfg = this.settings.resolveSmtpForTest(dto);
    if (!cfg) {
      return { ok: false, message: 'Enter host, port, sender email and password first.' };
    }

    // Always verify the connection; optionally send a real test email.
    const verified = await this.mail.verify(cfg);
    if (!verified.ok || !dto.to) return verified;

    const sent = await this.mail.sendWith(cfg, {
      to: dto.to,
      subject: 'Money Bank FX — SMTP test email',
      text: 'This is a test email from Money Bank FX. Your SMTP settings are working.',
      html: '<p>This is a test email from <strong>Money Bank FX</strong>. Your SMTP settings are working.</p>',
    });
    await this.audit.log({
      userId,
      action: 'SMTP_TEST_SENT',
      entityType: 'PlatformSetting',
      entityId: 'singleton',
      meta: { to: dto.to, ok: sent.ok },
    });
    return sent;
  }

  @Delete('smtp')
  async clearSmtp(@CurrentUser('sub') userId: string) {
    const status = await this.settings.clearSmtp(userId);
    await this.audit.log({
      userId,
      action: 'SMTP_CONFIG_CLEARED',
      entityType: 'PlatformSetting',
      entityId: 'singleton',
    });
    return status;
  }
}
