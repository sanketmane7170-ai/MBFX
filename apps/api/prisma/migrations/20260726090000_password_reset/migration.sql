-- Self-service password reset token (argon2 hash) + expiry on users.
ALTER TABLE "users" ADD COLUMN "resetTokenHash" TEXT;
ALTER TABLE "users" ADD COLUMN "resetTokenExpiresAt" TIMESTAMP(3);
