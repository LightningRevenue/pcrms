-- CreateTable
CREATE TABLE "UserMailboxPreference" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "mailboxAccountId" TEXT NOT NULL,

    CONSTRAINT "UserMailboxPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserMailboxPreference_mailboxAccountId_idx" ON "UserMailboxPreference"("mailboxAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "UserMailboxPreference_userId_mailboxAccountId_key" ON "UserMailboxPreference"("userId", "mailboxAccountId");

-- AddForeignKey
ALTER TABLE "UserMailboxPreference" ADD CONSTRAINT "UserMailboxPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMailboxPreference" ADD CONSTRAINT "UserMailboxPreference_mailboxAccountId_fkey" FOREIGN KEY ("mailboxAccountId") REFERENCES "MailboxAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
