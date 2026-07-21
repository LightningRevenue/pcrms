import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { WorkflowsView } from "@/components/workflows-view";
import { RestrictedAppPage } from "@/components/restricted-app-page";
import { requireWorkspace } from "@/lib/workspace";
import { hasFeatureAccess } from "@/lib/entitlements";

export default async function WorkflowsPage() {
  const session = await auth();
  if (session?.user?.role !== "owner" && session?.user?.role !== "admin") {
    return <RestrictedAppPage message="Only workspace admins and the owner can access workflows. Contact your workspace owner if you need access." />;
  }

  const { workspaceId } = await requireWorkspace();
  if (!(await hasFeatureAccess(workspaceId, "workflows_feature"))) {
    return <RestrictedAppPage message="Workflows aren't available on your current plan. Ask your workspace owner to upgrade." />;
  }

  const workflows = await db.workflow.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    include: { createdBy: true },
  });

  return <WorkflowsView workflows={workflows} />;
}
