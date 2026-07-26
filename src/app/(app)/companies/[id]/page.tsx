import { notFound } from "next/navigation";
import type { ComponentProps } from "react";
import { db } from "@/lib/db";
import { CompanyHighlightsBar } from "@/components/company-highlights-bar";
import { CompanyDetailPanel } from "@/components/company-detail-panel";
import { CompanyRelationsPanel } from "@/components/company-relations-panel";
import { CompanyTabs } from "@/components/company-tabs";
import { getCustomFieldValues } from "@/lib/actions/custom-fields";
import { listOpportunitiesForCompany } from "@/lib/actions/opportunities";
import { listPipelineStages } from "@/lib/actions/pipeline-stages";
import { listMyMailboxOptions } from "@/lib/actions/mailbox-preferences";
import { listMembers } from "@/lib/actions/members";
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

  const [
    companies,
    company,
    activity,
    people,
    customFields,
    opportunities,
    favorited,
    lists,
    stages,
    mailboxes,
    users,
  ] = await Promise.all([
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
    listPipelineStages(),
    listMyMailboxOptions(),
    listMembers(),
  ]);

  if (!company) notFound();

  const index = companies.findIndex((c) => c.id === id);
  const personIds = people.map((p) => p.id);

  const [tasks, emails, notes, calls] = await Promise.all([
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
    personIds.length
      ? db.call.findMany({
          where: { workspaceId, personId: { in: personIds } },
          orderBy: { startedAt: "desc" },
          include: { createdBy: true, opportunities: true },
        })
      : Promise.resolve([]),
  ]);

  const openStageLabels = new Set(stages.filter((s) => s.outcome === "open").map((s) => s.label));
  const openOpportunities = opportunities.filter((o) => openStageLabels.has(o.stage));
  const openPipeline = openOpportunities.reduce((sum, o) => sum + o.value, 0);

  return (
    <div className="flex flex-col h-screen">
      <CompanyHighlightsBar
        companyId={company.id}
        name={company.name || "Untitled"}
        domain={company.domain}
        linkedin={company.linkedin}
        annualRevenue={company.annualRevenue}
        industry={company.industry}
        employeeCount={company.employeeCount}
        ownerId={company.ownerId}
        index={index + 1}
        total={companies.length}
        isFavorited={favorited}
        people={people.map((p) => ({
          id: p.id,
          name: [p.firstName, p.lastName].filter(Boolean).join(" ") || "Untitled",
          email: p.email,
        }))}
        openPipeline={openPipeline}
        openDealCount={openOpportunities.length}
        stages={stages}
        opportunities={openOpportunities}
        mailboxes={mailboxes}
        users={users}
      />
      <div className="flex flex-1 min-h-0">
        <CompanyDetailPanel company={company} people={people} customFields={customFields} opportunities={opportunities} lists={lists} hideRelations />
        <div className="flex-1 min-w-0 overflow-y-auto">
          <CompanyTabs
            events={activity}
            tasks={tasks}
            emails={emails as ComponentProps<typeof CompanyTabs>["emails"]}
            notes={notes}
            calls={calls}
            companyName={company.name || "Untitled"}
            users={users}
          />
        </div>
        <CompanyRelationsPanel
          companyId={company.id}
          people={people}
          opportunities={opportunities}
          stages={stages}
          lists={lists}
        />
      </div>
    </div>
  );
}
