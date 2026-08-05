import { db } from "@/lib/db";
import { CompaniesView } from "@/components/companies-view";
import { listFieldDefinitions } from "@/lib/actions/custom-fields";
import { listMembers } from "@/lib/actions/members";
import { requireWorkspace, companyVisibilityFilter } from "@/lib/workspace";
import { parsePaging } from "@/lib/paging";

// Sortable columns, mapped to their Company scalar. Sorting happens in SQL so it covers every
// row, not just the page we loaded — anything not listed here (last activity, custom fields)
// has no column to order by and the header offers no sort.
//
// `nullable` drives the orderBy shape: Prisma only accepts the { sort, nulls } object form on
// nullable columns and rejects it outright on a non-null one like createdAt.
const SORT_COLUMNS: Record<string, { column: string; nullable: boolean }> = {
  domain: { column: "domain", nullable: true },
  createdAt: { column: "createdAt", nullable: false },
  linkedin: { column: "linkedin", nullable: true },
  address: { column: "address", nullable: true },
  industry: { column: "industry", nullable: true },
  country: { column: "country", nullable: true },
  employeeCount: { column: "employeeCount", nullable: true },
  annualRevenue: { column: "annualRevenue", nullable: true },
};

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; size?: string; sort?: string; dir?: string }>;
}) {
  const ctx = await requireWorkspace();
  const { workspaceId } = ctx;
  const sp = await searchParams;
  const { page, perPage } = parsePaging(sp.page, sp.size);

  // An unknown ?sort= falls back to the default ordering rather than erroring on a hand-edited URL.
  const sortKey = sp.sort && SORT_COLUMNS[sp.sort] ? sp.sort : null;
  const dir: "asc" | "desc" = sp.dir === "desc" ? "desc" : "asc";
  const orderBy = sortKey
    ? // nulls last so empty cells sink to the bottom in both directions, matching the grid's
      // client-side comparator on the un-paginated hosts.
      {
        [SORT_COLUMNS[sortKey].column]: SORT_COLUMNS[sortKey].nullable
          ? { sort: dir, nulls: "last" }
          : dir,
      }
    : { createdAt: "desc" as const };

  const where = { workspaceId, ...companyVisibilityFilter(ctx) };

  // Footer stats cover the whole set, not the current page — so they're counted in SQL rather
  // than derived from the rows we happen to have loaded.
  const [total, companies, emptyLinkedin, withAddress] = await Promise.all([
    db.company.count({ where }),
    db.company.findMany({
      where,
      orderBy: orderBy as never,
      include: { createdBy: true, owner: true, importBatch: true },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.company.count({ where: { ...where, linkedin: null } }),
    db.company.count({ where: { ...where, NOT: { address: null } } }),
  ]);

  const companyIds = companies.map((c) => c.id);

  const [lastActivity, customFields, customValues, users] = await Promise.all([
    db.activity.findMany({
      where: { workspaceId, entityType: "company", entityId: { in: companyIds } },
      orderBy: { createdAt: "desc" },
      distinct: ["entityId"],
    }),
    listFieldDefinitions("company"),
    db.customFieldValue.findMany({
      where: { workspaceId, recordId: { in: companyIds }, definition: { objectType: "company" } },
      select: { recordId: true, definitionId: true, value: true },
    }),
    listMembers(),
  ]);
  const lastActivityByCompany = new Map(lastActivity.map((a) => [a.entityId, a]));

  const customValuesByCompany = new Map<string, Record<string, string | null>>();
  for (const v of customValues) {
    const existing = customValuesByCompany.get(v.recordId);
    if (existing) existing[v.definitionId] = v.value;
    else customValuesByCompany.set(v.recordId, { [v.definitionId]: v.value });
  }

  return (
    <CompaniesView
      companies={companies}
      lastActivityByCompany={lastActivityByCompany}
      customFields={customFields}
      customValuesByCompany={customValuesByCompany}
      users={users}
      paging={{ page, perPage, total, emptyLinkedin, withAddress, sort: sortKey, dir }}
    />
  );
}
