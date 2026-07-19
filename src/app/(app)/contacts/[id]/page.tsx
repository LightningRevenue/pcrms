import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ContactHeaderBar } from "@/components/contact-header-bar";
import { ContactDetailPanel } from "@/components/contact-detail-panel";
import { ContactTabs } from "@/components/contact-tabs";
import { getCustomFieldValues } from "@/lib/actions/custom-fields";
import { listOpportunitiesForPerson } from "@/lib/actions/opportunities";
import { listPipelineStages } from "@/lib/actions/pipeline-stages";
import { listSequencesForPerson } from "@/lib/actions/sequences";
import { isFavorited } from "@/lib/actions/favorites";
import { listMyMailboxOptions } from "@/lib/actions/mailbox-preferences";
import { listListsForEntity } from "@/lib/actions/lists";
import { listMembers } from "@/lib/actions/members";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [people, contact, activity, emails, customFields, tasks, notes, opportunities, stages, sequenceEnrollments, favorited, mailboxes, lists, users, calls] = await Promise.all([
    db.person.findMany({ select: { id: true }, orderBy: { createdAt: "desc" } }),
    db.person.findUnique({
      where: { id },
      include: { company: true, createdBy: true, owner: true, importBatch: true },
    }),
    db.activity.findMany({
      where: { entityType: "person", entityId: id },
      include: { actor: true },
      orderBy: { createdAt: "desc" },
    }),
    db.email.findMany({
      where: { personId: id },
      orderBy: { sentAt: "desc" },
      include: {
        opens: { orderBy: { openedAt: "desc" } },
        opportunities: { include: { opportunity: true } },
      },
    }),
    getCustomFieldValues("person", id),
    db.task.findMany({
      where: { personId: id },
      orderBy: [{ done: "asc" }, { dueAt: "asc" }],
      include: { opportunities: { include: { opportunity: true } } },
    }),
    db.note.findMany({
      where: { personId: id },
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
      where: { personId: id },
      orderBy: { startedAt: "desc" },
      include: { createdBy: true },
    }),
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
      </div>
    </div>
  );
}
