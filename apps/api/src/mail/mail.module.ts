import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

/**
 * Global so admin/monitoring flows can inject MailService without importing.
 * Depends on the (also global) SettingsService for SMTP config.
 */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
