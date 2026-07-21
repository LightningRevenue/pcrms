import { db } from "@/lib/db";
import { CompaniesView } from "@/components/companies-view";
import { listFieldDefinitions } from "@/lib/actions/custom-fields";
import { requireWorkspace, companyVisibilityFilter } from "@/lib/workspace";

export default async function CompaniesPage() {
  const ctx = await requireWorkspace();
  const { workspaceId } = ctx;

  const companies = await db.company.findMany({
    where: { workspaceId, ...companyVisibilityFilter(ctx) },
    orderBy: { createdAt: "desc" },
    include: { createdBy: true, importBatch: true },
  });

  const [lastActivity, customFields] = await Promise.all([
    db.activity.findMany({
      where: { workspaceId, entityType: "company", entityId: { in: companies.map((c) => c.id) } },
      orderBy: { createdAt: "desc" },
      distinct: ["entityId"],
    }),
    listFieldDefinitions("company"),
  ]);
  const lastActivityByCompany = new Map(lastActivity.map((a) => [a.entityId, a]));

  return (
    <CompaniesView companies={companies} lastActivityByCompany={lastActivityByCompany} customFields={customFields} />
  );
}
