"use server";

import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { ENTITLEMENTS, checkLimit } from "@/lib/entitlements";

// Owner-facing usage snapshot for /settings/billing — every count/monthly entitlement's
// current usage against the workspace's plan, plus which features are enabled/disabled.
// Iterates ENTITLEMENTS so a new registry entry appears here with no page changes needed.
export async function getBillingSnapshot() {
  const { workspaceId } = await requireWorkspace();

  const [workspace, otherPlans] = await Promise.all([
    db.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { plan: { select: { id: true, name: true } }, stripeCustomerId: true },
    }),
    db.plan.findMany({
      where: { stripePriceId: { not: null } },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const entries = await Promise.all(
    Object.values(ENTITLEMENTS).map(async (def) => ({
      key: def.key,
      label: def.label,
      type: def.type,
      ...(await checkLimit(workspaceId, def.key)),
    }))
  );

  return {
    plan: workspace.plan,
    hasBillingAccount: !!workspace.stripeCustomerId,
    upgradePlans: otherPlans.filter((p) => p.id !== workspace.plan.id),
    usage: entries.filter((e): e is typeof e & { type: "count" | "monthly" } => e.type !== "feature"),
    features: entries.filter((e): e is typeof e & { type: "feature" } => e.type === "feature"),
  };
}
