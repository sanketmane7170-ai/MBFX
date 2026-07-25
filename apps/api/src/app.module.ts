import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './common/audit/audit.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { SettingsModule } from './settings/settings.module';
import { MailModule } from './mail/mail.module';
import { CopierModule } from './copier/copier.module';
import { AuthModule } from './auth/auth.module';
import { AdminsModule } from './admins/admins.module';
import { AccountsModule } from './accounts/accounts.module';
import { CopiersModule } from './copiers/copiers.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { SeedModule } from './seed/seed.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Registered here too so the global JwtAuthGuard can resolve JwtService.
    JwtModule.register({}),
    PrismaModule,
    AuditModule,
    CryptoModule,
    SettingsModule,
    MailModule,
    CopierModule,
    AuthModule,
    AdminsModule,
    AccountsModule,
    CopiersModule,
    MonitoringModule,
    SeedModule,
  ],
  providers: [
    // Order matters: authenticate first, then authorize.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
