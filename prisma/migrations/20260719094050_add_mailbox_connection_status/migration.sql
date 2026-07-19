-- AlterTable
ALTER TABLE "MailboxAccount" ADD COLUMN     "imapError" TEXT,
ADD COLUMN     "imapStatus" TEXT,
ADD COLUMN     "lastCheckedAt" TIMESTAMP(3),
ADD COLUMN     "smtpError" TEXT,
ADD COLUMN     "smtpStatus" TEXT;
