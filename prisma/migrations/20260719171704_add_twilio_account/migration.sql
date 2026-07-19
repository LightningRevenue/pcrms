-- CreateTable
CREATE TABLE "TwilioAccount" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "accountSid" TEXT NOT NULL,
    "authToken" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "TwilioAccount_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TwilioAccount" ADD CONSTRAINT "TwilioAccount_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
