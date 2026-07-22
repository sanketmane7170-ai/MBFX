/*
  Warnings:

  - Added the required column `encryptedPassword` to the `master_accounts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `encryptedPassword` to the `slave_accounts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "master_accounts" ADD COLUMN     "encryptedPassword" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "slave_accounts" ADD COLUMN     "encryptedPassword" TEXT NOT NULL;
