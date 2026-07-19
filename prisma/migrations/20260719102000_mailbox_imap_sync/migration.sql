-- AlterTable
ALTER TABLE "Email" ADD COLUMN     "imapUid" INTEGER,
ADD COLUMN     "mailboxAccountId" TEXT,
ALTER COLUMN "personId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MailboxAccount" ADD COLUMN     "imapLastUid" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Email_mailboxAccountId_imapUid_key" ON "Email"("mailboxAccountId", "imapUid");

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_mailboxAccountId_fkey" FOREIGN KEY ("mailboxAccountId") REFERENCES "MailboxAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
