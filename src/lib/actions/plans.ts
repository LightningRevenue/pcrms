"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { ENTITLEMENTS, type EntitlementKey } from "@/lib/entitlements";

export async function listPlans() {
  await requirePlatformAdmin();
  return db.plan.findMany({
    orderBy: { createdAt: "asc" },
    include: { limits: true, _count: { select: { workspaces: true } } },
  });
}

// Every ENTITLEMENTS key, joined with this plan's PlanLimit rows (a missing row means
// unlimited/enabled — see resolveLimit-equivalent logic in entitlements.ts). The plan
// editor UI iterates this list, so a new entitlements.ts entry appears here automatically
// with no UI code changes needed.
export async function getPlanEditorRows(planId: string) {
  await requirePlatformAdmin();
  const limits = await db.planLimit.findMany({ where: { planId } });
  const byKey = new Map(limits.map((l) => [l.key, l.value]));

  return Object.values(ENTITLEMENTS).map((def) => ({
    key: def.key,
    label: def.label,
    type: def.type,
    value: byKey.has(def.key) ? byKey.get(def.key)! : null, // null here means "no row" (unlimited/enabled)
    hasRow: byKey.has(def.key),
  }));
}

export async function createPlan(name: string) {
  await requirePlatformAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Plan name is required");
  const plan = await db.plan.create({ data: { name: trimmed } });
  revalidatePath("/admin/plans");
  return plan;
}

export async function deletePlan(planId: string) {
  await requirePlatformAdmin();
  const plan = await db.plan.findUniqueOrThrow({ where: { id: planId }, include: { _count: { select: { workspaces: true } } } });
  if (plan.isDefault) throw new Error("Can't delete the default plan.");
  if (plan._count.workspaces > 0) throw new Error("Reassign every workspace on this plan before deleting it.");
  await db.plan.delete({ where: { id: planId } });
  revalidatePath("/admin/plans");
}

export async function setDefaultPlan(planId: string) {
  await requirePlatformAdmin();
  await db.$transaction([
    db.plan.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
    db.plan.update({ where: { id: planId }, data: { isDefault: true } }),
  ]);
  revalidatePath("/admin/plans");
}

// value === null clears the PlanLimit row entirely (back to unlimited/enabled) rather than
// storing an explicit null, keeping "no row" as the one and only representation of
// unlimited — see the comment on PlanLimit in schema.prisma.
export async function updatePlanLimit(planId: string, key: EntitlementKey, value: number | null) {
  await requirePlatformAdmin();
  if (!(key in ENTITLEMENTS)) throw new Error("Unknown entitlement key");

  if (value === null) {
    await db.planLimit.deleteMany({ where: { planId, key } });
  } else {
    await db.planLimit.upsert({
      where: { planId_key: { planId, key } },
      create: { planId, key, value },
      update: { value },
    });
  }
  revalidatePath("/admin/plans");
}

export async function assignWorkspacePlan(workspaceId: string, planId: string) {
  await requirePlatformAdmin();
  await db.workspace.update({ where: { id: workspaceId }, data: { planId } });
  revalidatePath("/admin");
  revalidatePath(`/admin/${workspaceId}`);
}

// Links this plan to a Stripe Price so it can be self-serve checked out from
// /settings/billing — set to null to pull a plan back out of self-serve checkout without
// deleting it (e.g. a plan an operator still assigns manually).
export async function updatePlanStripePrice(planId: string, stripePriceId: string | null) {
  await requirePlatformAdmin();
  const trimmed = stripePriceId?.trim() || null;
  await db.plan.update({ where: { id: planId }, data: { stripePriceId: trimmed } });
  revalidatePath("/admin/plans");
}
