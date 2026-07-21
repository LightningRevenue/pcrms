import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { WorkflowsView } from "@/components/workflows-view";
import { RestrictedAppPage } from "@/components/restricted-app-page";
import { requireWorkspace } from "@/lib/workspace";

export default async function WorkflowsPage() {
  const session = await auth();
  if (session?.user?.role !== "owner" && session?.user?.role !== "admin") {
    return <RestrictedAppPage message="Only workspace admins and the owner can access workflows. Contact your workspace owner if you need access." />;
  }

  const { workspaceId } = await requireWorkspace();

  const workflows = await db.workflow.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    include: { createdBy: true },
  });

  return <WorkflowsView workflows={workflows} />;
}
