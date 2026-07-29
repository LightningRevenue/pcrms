import { db } from "@/lib/db";
import { ContactsView } from "@/components/contacts-view";
import { listNextTasksByPerson } from "@/lib/actions/tasks";
import { listFieldDefinitions } from "@/lib/actions/custom-fields";
import { listMembers } from "@/lib/actions/members";
import { listContactPipelineStages } from "@/lib/actions/contact-pipeline-stages";
import { listProspectFilterOptions } from "@/lib/actions/prospect-search";
import { listSavedViews, getSavedView } from "@/lib/actions/saved-prospect-views";
import { requireWorkspace, personVisibilityFilter } from "@/lib/workspace";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; owner?: string }>;
}) {
  const ctx = await requireWorkspace();
  const { workspaceId, userId } = ctx;
  const { view: viewId } = await searchParams;

  const people = await db.person.findMany({
    where: { workspaceId, ...personVisibilityFilter(ctx) },
    orderBy: { createdAt: "desc" },
    include: {
      company: true,
      createdBy: true,
      owner: true,
      importBatch: true,
      // repliedAt drives the "touched, never replied" retargeting filter.
      campaignMembers: { include: { campaign: true }, orderBy: { addedAt: "desc" } },
    },
  });
  const personIds = people.map((p) => p.id);

  const [
    lastActivity,
    nextTasks,
    customFields,
    users,
    openTasks,
    notes,
    stages,
    filterOptions,
    savedViews,
    // A ?view=<id> from a colleague resolves for any workspace member, so an unknown or
    // foreign id simply means "no view loaded" rather than an error page.
    initialView,
    customValues,
    companyCounts,
  ] = await Promise.all([
    db.activity.findMany({
      where: {
        workspaceId,
        entityType: "person",
        entityId: { in: personIds },
        kind: { not: "created" },
      },
      orderBy: { createdAt: "desc" },
      distinct: ["entityId"],
    }),
    listNextTasksByPerson(personIds),
    listFieldDefinitions("person"),
    listMembers(),
    db.task.findMany({
      where: { workspaceId, personId: { in: personIds }, done: false },
      orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    }),
    db.note.findMany({
      where: { workspaceId, personId: { in: personIds } },
      orderBy: { createdAt: "desc" },
      include: { createdBy: true },
    }),
    listContactPipelineStages(),
    listProspectFilterOptions(),
    listSavedViews(),
    viewId ? getSavedView(viewId) : Promise.resolve(null),
    // CustomFieldValue is EAV keyed by recordId with no relation on Person, so custom-field
    // values can't ride along on the include above — they need their own query.
    db.customFieldValue.findMany({
      where: { workspaceId, recordId: { in: personIds }, definition: { objectType: "person" } },
      select: { recordId: true, definitionId: true, value: true },
    }),
    // Contacts-per-company, for the "at least N contacts at this company" filter.
    db.person.groupBy({
      by: ["companyId"],
      where: { workspaceId, deletedAt: null, companyId: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const lastActivityByPerson = new Map(lastActivity.map((a) => [a.entityId, a]));

  const customValuesByPerson = new Map<string, Record<string, string | null>>();
  for (const v of customValues) {
    const existing = customValuesByPerson.get(v.recordId);
    if (existing) existing[v.definitionId] = v.value;
    else customValuesByPerson.set(v.recordId, { [v.definitionId]: v.value });
  }

  const contactsPerCompany = new Map(
    companyCounts.map((c) => [c.companyId as string, c._count._all] as const)
  );

  const tasksByPerson = new Map<string, typeof openTasks>();
  for (const task of openTasks) {
    const list = tasksByPerson.get(task.personId);
    if (list) list.push(task);
    else tasksByPerson.set(task.personId, [task]);
  }

  const notesByPerson = new Map<string, typeof notes>();
  for (const note of notes) {
    const list = notesByPerson.get(note.personId);
    if (list) list.push(note);
    else notesByPerson.set(note.personId, [note]);
  }

  return (
    <ContactsView
      people={people}
      lastActivityByPerson={lastActivityByPerson}
      nextTaskByPerson={nextTasks}
      tasksByPerson={tasksByPerson}
      notesByPerson={notesByPerson}
      customFields={customFields}
      users={users}
      stages={stages}
      filterOptions={filterOptions}
      savedViews={savedViews}
      initialView={initialView}
      currentUserId={userId}
      customValuesByPerson={customValuesByPerson}
      contactsPerCompany={contactsPerCompany}
    />
  );
}
