-- CreateTable
CREATE TABLE "Playbook" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Playbook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaybookSection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "playbookId" TEXT NOT NULL,

    CONSTRAINT "PlaybookSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlaybookSection_playbookId_idx" ON "PlaybookSection"("playbookId");

-- AddForeignKey
ALTER TABLE "Playbook" ADD CONSTRAINT "Playbook_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookSection" ADD CONSTRAINT "PlaybookSection_playbookId_fkey" FOREIGN KEY ("playbookId") REFERENCES "Playbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
