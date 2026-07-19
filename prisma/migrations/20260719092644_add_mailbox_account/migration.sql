-- CreateTable
CREATE TABLE "MailboxAccount" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "smtpHost" TEXT NOT NULL,
    "smtpPort" INTEGER NOT NULL DEFAULT 587,
    "imapHost" TEXT NOT NULL,
    "imapPort" INTEGER NOT NULL DEFAULT 993,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "MailboxAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MailboxAccount_createdById_idx" ON "MailboxAccount"("createdById");

-- AddForeignKey
ALTER TABLE "MailboxAccount" ADD CONSTRAINT "MailboxAccount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
