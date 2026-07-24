-- AlterTable
ALTER TABLE "FieldDefinition" ADD COLUMN     "dependsOnFieldId" TEXT,
ADD COLUMN     "dependsOnValue" TEXT,
ADD COLUMN     "layoutW" INTEGER,
ADD COLUMN     "layoutX" INTEGER,
ADD COLUMN     "layoutY" INTEGER;

-- CreateIndex
CREATE INDEX "FieldDefinition_dependsOnFieldId_idx" ON "FieldDefinition"("dependsOnFieldId");

-- AddForeignKey
ALTER TABLE "FieldDefinition" ADD CONSTRAINT "FieldDefinition_dependsOnFieldId_fkey" FOREIGN KEY ("dependsOnFieldId") REFERENCES "FieldDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
