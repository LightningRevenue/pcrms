import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getListCompanies, getListPeople, getListOpportunities } from "@/lib/actions/lists";
import { listNextTasksByPerson } from "@/lib/actions/tasks";
import { listFieldDefinitions } from "@/lib/actions/custom-fields";
import { ListDetailView } from "@/components/list-detail-view";
import { requireWorkspace } from "@/lib/workspace";

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { workspaceId } = await requireWorkspace();
  const list = await db.list.findUnique({ where: { id, workspaceId }, include: { items: true } });
  if (!list) notFound();

  const entityIds = list.items.map((i) => i.entityId);

  if (list.entityType === "company") {
    const [companies, customFields] = await Promise.all([
      getListCompanies(entityIds),
      listFieldDefinitions("company"),
    ]);
    const lastActivity = await db.activity.findMany({
      where: { workspaceId, entityType: "company", entityId: { in: companies.map((c) => c.id) } },
      orderBy: { createdAt: "desc" },
      distinct: ["entityId"],
    });
    const lastActivityByCompany = new Map(lastActivity.map((a) => [a.entityId, a]));

    return (
      <ListDetailView
        id={list.id}
        name={list.name}
        entityType="company"
        companies={companies}
        lastActivityByCompany={lastActivityByCompany}
        customFields={customFields}
      />
    );
  }

  if (list.entityType === "person") {
    const [people, customFields] = await Promise.all([
      getListPeople(entityIds),
      listFieldDefinitions("person"),
    ]);
    const [lastActivity, nextTasks] = await Promise.all([
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
    ]);
    const lastActivityByPerson = new Map(lastActivity.map((a) => [a.entityId, a]));

    return (
      <ListDetailView
        id={list.id}
        name={list.name}
        entityType="person"
        people={people}
        lastActivityByPerson={lastActivityByPerson}
        nextTaskByPerson={nextTasks}
        customFields={customFields}
      />
    );
  }

  const opportunities = await getListOpportunities(entityIds);
  return <ListDetailView id={list.id} name={list.name} entityType="opportunity" opportunities={opportunities} />;
}
