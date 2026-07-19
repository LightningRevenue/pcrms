-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'field_update',
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Activity_entityType_entityId_createdAt_idx" ON "Activity"("entityType", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate existing data
INSERT INTO "Activity" ("id", "entityType", "entityId", "kind", "field", "oldValue", "newValue", "createdAt", "actorId")
SELECT "id", 'person', "personId", "kind", "field", "oldValue", "newValue", "createdAt", "actorId" FROM "PersonActivity";

INSERT INTO "Activity" ("id", "entityType", "entityId", "kind", "field", "oldValue", "newValue", "createdAt", "actorId")
SELECT "id", 'company', "companyId", "kind", "field", "oldValue", "newValue", "createdAt", "actorId" FROM "CompanyActivity";

-- DropTable
DROP TABLE "PersonActivity";
DROP TABLE "CompanyActivity";
