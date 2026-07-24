-- CreateTable
CREATE TABLE "ObjectDefinition" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameSingular" TEXT NOT NULL,
    "namePlural" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'Package',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "ObjectDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "relationTarget" TEXT,
    "objectDefinitionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "FieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObjectRecord" (
    "id" TEXT NOT NULL,
    "values" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "objectDefinitionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "ObjectRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ObjectDefinition_workspaceId_idx" ON "ObjectDefinition"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ObjectDefinition_workspaceId_slug_key" ON "ObjectDefinition"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX "FieldDefinition_workspaceId_idx" ON "FieldDefinition"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "FieldDefinition_objectDefinitionId_key_key" ON "FieldDefinition"("objectDefinitionId", "key");

-- CreateIndex
CREATE INDEX "ObjectRecord_workspaceId_objectDefinitionId_idx" ON "ObjectRecord"("workspaceId", "objectDefinitionId");

-- AddForeignKey
ALTER TABLE "ObjectDefinition" ADD CONSTRAINT "ObjectDefinition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjectDefinition" ADD CONSTRAINT "ObjectDefinition_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldDefinition" ADD CONSTRAINT "FieldDefinition_objectDefinitionId_fkey" FOREIGN KEY ("objectDefinitionId") REFERENCES "ObjectDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldDefinition" ADD CONSTRAINT "FieldDefinition_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjectRecord" ADD CONSTRAINT "ObjectRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjectRecord" ADD CONSTRAINT "ObjectRecord_objectDefinitionId_fkey" FOREIGN KEY ("objectDefinitionId") REFERENCES "ObjectDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjectRecord" ADD CONSTRAINT "ObjectRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
