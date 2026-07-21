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
    include: { company: true, createdBy: true, owner: true, importBatch: true },
  });
  const personIds = people.map((p) => p.id);

  const [lastActivity, nextTasks, customFields, users, openTasks, notes] = await Promise.all([
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
  ]);
  const lastActivityByPerson = new Map(lastActivity.map((a) => [a.entityId, a]));

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
    />
  );
}
