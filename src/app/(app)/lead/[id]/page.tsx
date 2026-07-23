import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ContactHeaderBar } from "@/components/contact-header-bar";
import { ContactDetailPanel } from "@/components/contact-detail-panel";
import { ContactTabs } from "@/components/contact-tabs";
import { LeadRelationshipsPanel } from "@/components/lead-relationships-panel";
import { getCustomFieldValues } from "@/lib/actions/custom-fields";
import { listOpportunitiesForPerson } from "@/lib/actions/opportunities";
import { listPipelineStages } from "@/lib/actions/pipeline-stages";
import { listSequencesForPerson } from "@/lib/actions/sequences";
import { isFavorited } from "@/lib/actions/favorites";
import { listMyMailboxOptions } from "@/lib/actions/mailbox-preferences";
import { listListsForEntity } from "@/lib/actions/lists";
import { listMembers } from "@/lib/actions/members";
import { listCompanyLinksForPerson, listOpportunityLinksForPerson } from "@/lib/actions/relationships";
import { requireWorkspace, personVisibilityFilter } from "@/lib/workspace";

// HubSpot-style 3-column layout, kept as a separate route from /contacts/[id] so it can be
// iterated on without touching the existing contact page. Toggled on from /contacts via the
// "New View" button (see contacts-view.tsx), which just swaps the row links to /lead/[id].
export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireWorkspace();
  const { workspaceId } = ctx;

  const [
    people,
    contact,
    activity,
    emails,
    customFields,
    tasks,
    notes,
    opportunities,
    stages,
    sequenceEnrollments,
    favorited,
    mailboxes,
    lists,
    users,
    calls,
    companyLinks,
    opportunityLinks,
  ] = await Promise.all([
    db.person.findMany({ where: { workspaceId, ...personVisibilityFilter(ctx) }, select: { id: true }, orderBy: { createdAt: "desc" } }),
    db.person.findUnique({
      where: { id, workspaceId, ...personVisibilityFilter(ctx) },
      include: { company: true, createdBy: true, owner: true, importBatch: true },
    }),
    db.activity.findMany({
      where: { workspaceId, entityType: "person", entityId: id },
      include: { actor: true },
      orderBy: { createdAt: "desc" },
    }),
    db.email.findMany({
      where: { workspaceId, personId: id },
      orderBy: { sentAt: "desc" },
      include: {
        opens: { orderBy: { openedAt: "desc" } },
        opportunities: { include: { opportunity: true } },
        campaignMember: { select: { campaign: { select: { id: true, name: true } } } },
      },
    }),
    getCustomFieldValues("person", id),
    db.task.findMany({
      where: { workspaceId, personId: id },
      orderBy: [{ done: "asc" }, { dueAt: "asc" }],
      include: { opportunities: { include: { opportunity: true } } },
    }),
    db.note.findMany({
      where: { workspaceId, personId: id },
      orderBy: { createdAt: "desc" },
      include: { createdBy: true, opportunities: { include: { opportunity: true } } },
    }),
    listOpportunitiesForPerson(id),
    listPipelineStages(),
    listSequencesForPerson(id),
    isFavorited("person", id),
    listMyMailboxOptions(),
    listListsForEntity("person", id),
    listMembers(),
    db.call.findMany({
      where: { workspaceId, personId: id },
      orderBy: { startedAt: "desc" },
      include: { createdBy: true },
    }),
    listCompanyLinksForPerson(id),
    listOpportunityLinksForPerson(id),
  ]);

  if (!contact) notFound();

  const index = people.findIndex((p) => p.id === id);
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
  const openStageLabels = new Set(stages.filter((s) => s.outcome === "open").map((s) => s.label));
  const openOpportunities = opportunities.filter((o) => openStageLabels.has(o.stage));

  return (
    <div className="flex flex-col h-screen">
      <ContactHeaderBar
        contactId={contact.id}
        name={name}
        index={index + 1}
        total={people.length}
        companyName={contact.company?.name ?? null}
        personEmail={contact.email}
        personPhone={contact.phone}
        stages={stages}
        opportunities={openOpportunities}
        isFavorited={favorited}
        mailboxes={mailboxes}
      />
      <div className="flex flex-1 min-h-0">
        <ContactDetailPanel
          contact={contact}
          customFields={customFields}
          opportunities={opportunities}
          sequenceEnrollments={sequenceEnrollments.filter((e) => e.status === "active")}
          lists={lists}
          users={users}
        />
        <div className="flex-1 min-w-0 overflow-y-auto">
          <ContactTabs
            events={activity}
            personId={contact.id}
            personName={name}
            personEmail={contact.email}
            emails={emails}
            tasks={tasks}
            notes={notes}
            opportunities={openOpportunities}
            mailboxes={mailboxes}
            calls={calls}
          />
        </div>
        <LeadRelationshipsPanel
          personId={contact.id}
          primaryCompanyId={contact.companyId}
          companyLinks={companyLinks}
          opportunityLinks={opportunityLinks}
        />
      </div>
    </div>
  );
}
