import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getOpportunity } from "@/lib/actions/opportunities";
import { listPipelineStages } from "@/lib/actions/pipeline-stages";
import { listNotesForOpportunity } from "@/lib/actions/notes";
import { isFavorited } from "@/lib/actions/favorites";
import { listMyMailboxOptions } from "@/lib/actions/mailbox-preferences";
import { listListsForEntity } from "@/lib/actions/lists";
import { listMembers } from "@/lib/actions/members";
import { listPeopleForOpportunity } from "@/lib/actions/relationships";
import { getCustomFieldValues } from "@/lib/actions/custom-fields";
import { deriveNextStep, lastTouchOf } from "@/lib/next-step";
import { OpportunityDetailView } from "@/components/opportunity-detail-view";
import { requireWorkspace, opportunityVisibilityFilter } from "@/lib/workspace";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireWorkspace();
  const { workspaceId } = ctx;

  const [all, opportunity, stages, events, favorited, mailboxes, lists, users, stakeholders, customFields] =
    await Promise.all([
      db.opportunity.findMany({ where: { workspaceId, ...opportunityVisibilityFilter(ctx) }, select: { id: true }, orderBy: { createdAt: "desc" } }),
      getOpportunity(id),
      listPipelineStages(),
      db.activity.findMany({
        where: { workspaceId, entityType: "opportunity", entityId: id },
        include: { actor: true },
        orderBy: { createdAt: "desc" },
      }),
      isFavorited("opportunity", id),
      listMyMailboxOptions(),
      listListsForEntity("opportunity", id),
      listMembers(),
      listPeopleForOpportunity(id),
      getCustomFieldValues("opportunity", id),
    ]);

  if (!opportunity) notFound();

  const index = all.findIndex((o) => o.id === id);

  const [tasks, emails, notes, calls] = await Promise.all([
    db.task.findMany({
      where: { workspaceId, opportunities: { some: { opportunityId: id } } },
      orderBy: [{ done: "asc" }, { dueAt: "asc" }],
      include: { person: true, opportunities: { include: { opportunity: true } } },
    }),
    opportunity.contactId
      ? db.email.findMany({
          where: { workspaceId, personId: opportunity.contactId },
          orderBy: { sentAt: "desc" },
          include: {
            opens: { orderBy: { openedAt: "desc" } },
            opportunities: { include: { opportunity: true } },
            campaignMember: { select: { campaign: { select: { id: true, name: true } } } },
          },
        })
      : Promise.resolve([]),
    listNotesForOpportunity(id),
    db.call.findMany({
      where: { workspaceId, opportunities: { some: { opportunityId: id } } },
      select: { startedAt: true },
    }),
  ]);

  // Same "what do I do next" derivation as /lead/[id], scoped to this deal's tasks and touches.
  // No sequences here — enrollment is per-person, not per-deal.
  const nextStep = deriveNextStep(tasks, [], lastTouchOf(emails, calls));

  return (
    <OpportunityDetailView
      opportunity={opportunity}
      index={index + 1}
      total={all.length}
      stages={stages}
      events={events}
      tasks={tasks}
      emails={emails}
      notes={notes}
      isFavorited={favorited}
      mailboxes={mailboxes}
      lists={lists}
      users={users}
      stakeholders={stakeholders}
      customFields={customFields}
      nextStep={nextStep}
    />
  );
}
