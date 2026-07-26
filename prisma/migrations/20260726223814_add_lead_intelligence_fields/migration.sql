-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "country" TEXT,
ADD COLUMN     "employeeCount" INTEGER,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "revenueRange" TEXT;

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "department" TEXT,
ADD COLUMN     "seniority" TEXT;

-- CreateIndex
CREATE INDEX "Company_workspaceId_industry_idx" ON "Company"("workspaceId", "industry");

-- CreateIndex
CREATE INDEX "Company_workspaceId_country_idx" ON "Company"("workspaceId", "country");

-- CreateIndex
CREATE INDEX "Company_workspaceId_revenueRange_idx" ON "Company"("workspaceId", "revenueRange");

-- CreateIndex
CREATE INDEX "Person_workspaceId_seniority_idx" ON "Person"("workspaceId", "seniority");

-- CreateIndex
CREATE INDEX "Person_workspaceId_department_idx" ON "Person"("workspaceId", "department");
