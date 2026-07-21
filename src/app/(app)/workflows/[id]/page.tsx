import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { WorkflowHeaderBar } from "@/components/workflow-header-bar";
import { WorkflowBuilder } from "@/components/workflow-builder";
import { RestrictedAppPage } from "@/components/restricted-app-page";
import { requireWorkspace } from "@/lib/workspace";
import { hasFeatureAccess } from "@/lib/entitlements";

export default async function WorkflowBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  if (session?.user?.role !== "owner" && session?.user?.role !== "admin") {
    return <RestrictedAppPage message="Only workspace admins and the owner can access workflows. Contact your workspace owner if you need access." />;
  }

  const { workspaceId } = await requireWorkspace();
  if (!(await hasFeatureAccess(workspaceId, "workflows_feature"))) {
    return <RestrictedAppPage message="Workflows aren't available on your current plan. Ask your workspace owner to upgrade." />;
  }

  const workflow = await db.workflow.findUnique({ where: { id, workspaceId } });
  if (!workflow) notFound();

  return (
    <div className="flex flex-col h-screen">
      <WorkflowHeaderBar workflowId={workflow.id} name={workflow.name} active={workflow.active} />
      <WorkflowBuilder workflowId={workflow.id} triggerType={workflow.triggerType} />
    </div>
  );
}
