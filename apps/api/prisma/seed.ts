/**
 * Standalone super-admin seed (equivalent to the on-boot SuperAdminSeeder).
 * Run: pnpm --filter @tcp/api seed
 */
import { PrismaClient, Role, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;
    if (!email || !password) {
      console.error('Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD first.');
      process.exitCode = 1;
      return;
    }

    const existing = await prisma.user.findFirst({
      where: { role: Role.SUPER_ADMIN },
    });
    if (existing) {
      console.log(`Super admin already exists: ${existing.email}`);
      return;
    }

    const passwordHash = await argon2.hash(password);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        role: Role.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
      },
    });
    console.log(`Seeded super admin: ${user.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
