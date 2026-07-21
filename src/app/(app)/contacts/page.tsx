import { db } from "@/lib/db";
import { ContactsView } from "@/components/contacts-view";
import { listNextTasksByPerson } from "@/lib/actions/tasks";
import { listFieldDefinitions } from "@/lib/actions/custom-fields";
import { listMembers } from "@/lib/actions/members";
import { requireWorkspace, personVisibilityFilter } from "@/lib/workspace";

export default async function ContactsPage() {
  const ctx = await requireWorkspace();
  const { workspaceId } = ctx;

  const people = await db.person.findMany({
    where: { workspaceId, ...personVisibilityFilter(ctx) },
    orderBy: { createdAt: "desc" },
    include: { company: true, createdBy: true, importBatch: true },
  });

  const [lastActivity, nextTasks, customFields, users] = await Promise.all([
    db.activity.findMany({
      where: {
        workspaceId,
        entityType: "person",
        entityId: { in: people.map((p) => p.id) },
        kind: { not: "created" },
      },
      orderBy: { createdAt: "desc" },
      distinct: ["entityId"],
    }),
    listNextTasksByPerson(people.map((p) => p.id)),
    listFieldDefinitions("person"),
    listMembers(),
  ]);
  const lastActivityByPerson = new Map(lastActivity.map((a) => [a.entityId, a]));

  return (
    <ContactsView
      people={people}
      lastActivityByPerson={lastActivityByPerson}
      nextTaskByPerson={nextTasks}
      customFields={customFields}
      users={users}
    />
  );
}
