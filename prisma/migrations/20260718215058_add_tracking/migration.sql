-- CreateTable
CREATE TABLE "WorkspaceSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "WorkspaceSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "EmailOpen" (
    "id" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,
    "emailId" TEXT NOT NULL,

    CONSTRAINT "EmailOpen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailOpen_emailId_idx" ON "EmailOpen"("emailId");

-- AddForeignKey
ALTER TABLE "EmailOpen" ADD CONSTRAINT "EmailOpen_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "Email"("id") ON DELETE CASCADE ON UPDATE CASCADE;
