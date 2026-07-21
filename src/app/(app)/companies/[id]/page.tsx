import { notFound } from "next/navigation";
import type { ComponentProps } from "react";
import { db } from "@/lib/db";
import { CompanyHeaderBar } from "@/components/company-header-bar";
import { CompanyDetailPanel } from "@/components/company-detail-panel";
import { CompanyTabs } from "@/components/company-tabs";
import { getCustomFieldValues } from "@/lib/actions/custom-fields";
import { listOpportunitiesForCompany } from "@/lib/actions/opportunities";
import { isFavorited } from "@/lib/actions/favorites";
import { listListsForEntity } from "@/lib/actions/lists";
import { requireWorkspace, companyVisibilityFilter, personVisibilityFilter } from "@/lib/workspace";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireWorkspace();
  const { workspaceId } = ctx;

  const [companies, company, activity, people, customFields, opportunities, favorited, lists] = await Promise.all([
    db.company.findMany({ where: { workspaceId, ...companyVisibilityFilter(ctx) }, select: { id: true }, orderBy: { createdAt: "desc" } }),
    db.company.findUnique({ where: { id, workspaceId, ...companyVisibilityFilter(ctx) }, include: { createdBy: true, importBatch: true } }),
    db.activity.findMany({
      where: { workspaceId, entityType: "company", entityId: id },
      include: { actor: true },
      orderBy: { createdAt: "desc" },
    }),
    db.person.findMany({ where: { workspaceId, companyId: id, ...personVisibilityFilter(ctx) }, orderBy: { firstName: "asc" } }),
    getCustomFieldValues("company", id),
    listOpportunitiesForCompany(id),
    isFavorited("company", id),
    listListsForEntity("company", id),
  ]);

  if (!company) notFound();

  const index = companies.findIndex((c) => c.id === id);
  const personIds = people.map((p) => p.id);

  const [tasks, emails, notes] = await Promise.all([
    personIds.length
      ? db.task.findMany({
          where: { workspaceId, personId: { in: personIds } },
          orderBy: [{ done: "asc" }, { dueAt: "asc" }],
          include: { person: true, opportunities: { include: { opportunity: true } } },
        })
      : Promise.resolve([]),
    personIds.length
      ? db.email.findMany({
          where: { workspaceId, personId: { in: personIds } },
          orderBy: { sentAt: "desc" },
          include: {
            person: true,
            opens: { orderBy: { openedAt: "desc" } },
            opportunities: { include: { opportunity: true } },
            campaignMember: { select: { campaign: { select: { id: true, name: true } } } },
          },
        })
      : Promise.resolve([]),
    personIds.length
      ? db.note.findMany({
          where: { workspaceId, personId: { in: personIds } },
          orderBy: { createdAt: "desc" },
          include: { person: true, createdBy: true, opportunities: { include: { opportunity: true } } },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col h-screen">
      <CompanyHeaderBar
        companyId={company.id}
        name={company.name || "Untitled"}
        index={index + 1}
        total={companies.length}
        isFavorited={favorited}
      />
      <div className="flex flex-1 min-h-0">
        <CompanyDetailPanel company={company} people={people} customFields={customFields} opportunities={opportunities} lists={lists} />
        <div className="flex-1 min-w-0 overflow-y-auto">
          <CompanyTabs
            events={activity}
            tasks={tasks}
            emails={emails as ComponentProps<typeof CompanyTabs>["emails"]}
            notes={notes}
          />
        </div>
      </div>
    </div>
  );
}
