-- CreateTable
CREATE TABLE "PersonCompany" (
    "personId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "PersonCompany_pkey" PRIMARY KEY ("personId","companyId")
);

-- CreateTable
CREATE TABLE "OpportunityPerson" (
    "opportunityId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "OpportunityPerson_pkey" PRIMARY KEY ("opportunityId","personId")
);

-- CreateIndex
CREATE INDEX "PersonCompany_companyId_idx" ON "PersonCompany"("companyId");

-- CreateIndex
CREATE INDEX "PersonCompany_workspaceId_idx" ON "PersonCompany"("workspaceId");

-- CreateIndex
CREATE INDEX "OpportunityPerson_personId_idx" ON "OpportunityPerson"("personId");

-- CreateIndex
CREATE INDEX "OpportunityPerson_workspaceId_idx" ON "OpportunityPerson"("workspaceId");

-- AddForeignKey
ALTER TABLE "PersonCompany" ADD CONSTRAINT "PersonCompany_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonCompany" ADD CONSTRAINT "PersonCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonCompany" ADD CONSTRAINT "PersonCompany_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityPerson" ADD CONSTRAINT "OpportunityPerson_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityPerson" ADD CONSTRAINT "OpportunityPerson_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityPerson" ADD CONSTRAINT "OpportunityPerson_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
