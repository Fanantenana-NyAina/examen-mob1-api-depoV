-- AlterTable
ALTER TABLE "Account" ADD COLUMN "resetPasswordExpiresAt" DATETIME;
ALTER TABLE "Account" ADD COLUMN "resetPasswordToken" TEXT;
