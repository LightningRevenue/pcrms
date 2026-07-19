import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { WorkflowHeaderBar } from "@/components/workflow-header-bar";
import { WorkflowBuilder } from "@/components/workflow-builder";

export default async function WorkflowBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const workflow = await db.workflow.findUnique({ where: { id } });
  if (!workflow) notFound();

  return (
    <div className="flex flex-col h-screen">
      <WorkflowHeaderBar workflowId={workflow.id} name={workflow.name} active={workflow.active} />
      <WorkflowBuilder workflowId={workflow.id} triggerType={workflow.triggerType} />
    </div>
  );
}
