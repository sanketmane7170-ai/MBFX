import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';

/**
 * FR-1: on startup, ensure exactly one Super Admin exists.
 * Reads SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD from the environment,
 * hashes the password, and creates the account only if none is present.
 */
@Injectable()
export class SuperAdminSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(SuperAdminSeeder.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.config.get<string>('SUPER_ADMIN_EMAIL');
    const password = this.config.get<string>('SUPER_ADMIN_PASSWORD');

    if (!email || !password) {
      this.logger.warn(
        'SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD not set — skipping super-admin seed.',
      );
      return;
    }

    const existing = await this.prisma.user.findFirst({
      where: { role: Role.SUPER_ADMIN },
    });
    if (existing) {
      this.logger.log(`Super admin already present (${existing.email}).`);
      return;
    }

    const passwordHash = await argon2.hash(password);
    const created = await this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        role: Role.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
      },
    });
    this.logger.log(`Seeded super admin: ${created.email}`);
  }
}
