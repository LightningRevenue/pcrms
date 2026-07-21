"use server";

import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { ENTITLEMENTS, checkLimit } from "@/lib/entitlements";

// Owner-facing usage snapshot for /settings/billing — every count/monthly entitlement's
// current usage against the workspace's plan, plus which features are enabled/disabled.
// Iterates ENTITLEMENTS so a new registry entry appears here with no page changes needed.
export async function getBillingSnapshot() {
  const { workspaceId } = await requireWorkspace();

  const workspace = await db.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { plan: { select: { id: true, name: true } } },
  });

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
    usage: entries.filter((e): e is typeof e & { type: "count" | "monthly" } => e.type !== "feature"),
    features: entries.filter((e): e is typeof e & { type: "feature" } => e.type === "feature"),
  };
}
