-- CreateTable
CREATE TABLE "PersonActivity" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'field_update',
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "personId" TEXT NOT NULL,
    "actorId" TEXT,

    CONSTRAINT "PersonActivity_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PersonActivity" ADD CONSTRAINT "PersonActivity_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonActivity" ADD CONSTRAINT "PersonActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
