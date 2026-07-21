-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" INTEGER,
    "planId" TEXT NOT NULL,

    CONSTRAINT "PlanLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PlanLimit_planId_key_key" ON "PlanLimit"("planId", "key");

-- AddForeignKey
ALTER TABLE "PlanLimit" ADD CONSTRAINT "PlanLimit_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed a single default plan every existing (and future, until an operator adds more)
-- workspace lands on. All entitlement keys start unlimited/enabled — no PlanLimit rows
-- means "no restriction" (see resolveLimit() in src/lib/entitlements.ts).
INSERT INTO "Plan" ("id", "name", "isDefault") VALUES ('plan-default', 'Default', true);

-- AlterTable: add planId nullable first so existing rows can be backfilled before the
-- NOT NULL constraint goes on, same pattern as the emailDomain backfill in
-- 20260720003000_workspace_domain_and_invites.
ALTER TABLE "Workspace" ADD COLUMN "planId" TEXT,
ADD COLUMN "stripeCustomerId" TEXT,
ADD COLUMN "stripeSubscriptionId" TEXT;

UPDATE "Workspace" SET "planId" = 'plan-default' WHERE "planId" IS NULL;

ALTER TABLE "Workspace" ALTER COLUMN "planId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_stripeCustomerId_key" ON "Workspace"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_stripeSubscriptionId_key" ON "Workspace"("stripeSubscriptionId");

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
