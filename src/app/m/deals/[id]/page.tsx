import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import { getOpportunity } from "@/lib/actions/opportunities";
import { listPipelineStages } from "@/lib/actions/pipeline-stages";
import { listNotesForOpportunity } from "@/lib/actions/notes";
import { MobileDealDetail } from "@/components/mobile-deal-detail";

export default async function MobileDealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspaceId } = await requireWorkspace();

  const [opportunity, stages, tasks, notes] = await Promise.all([
    getOpportunity(id),
    listPipelineStages(),
    db.task.findMany({
      where: { workspaceId, opportunities: { some: { opportunityId: id } } },
      orderBy: [{ done: "asc" }, { dueAt: "asc" }],
    }),
    listNotesForOpportunity(id),
  ]);

  if (!opportunity) notFound();

  return <MobileDealDetail opportunity={opportunity} stages={stages} tasks={tasks} notes={notes} />;
}
