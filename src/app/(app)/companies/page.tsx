import { db } from "@/lib/db";
import { CompaniesView } from "@/components/companies-view";
import { listFieldDefinitions } from "@/lib/actions/custom-fields";

export default async function CompaniesPage() {
  const companies = await db.company.findMany({
    orderBy: { createdAt: "desc" },
    include: { createdBy: true, importBatch: true },
  });

  const [lastActivity, customFields] = await Promise.all([
    db.activity.findMany({
      where: { entityType: "company", entityId: { in: companies.map((c) => c.id) } },
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
