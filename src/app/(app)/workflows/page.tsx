import { db } from "@/lib/db";
import { WorkflowsView } from "@/components/workflows-view";

export default async function WorkflowsPage() {
  const workflows = await db.workflow.findMany({
    orderBy: { createdAt: "desc" },
    include: { createdBy: true },
  });

  return <WorkflowsView workflows={workflows} />;
}
