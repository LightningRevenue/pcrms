import assert from "node:assert/strict";
import { buildProspectWhere } from "./prospect-where";

const coldBefore = new Date("2026-01-01T00:00:00Z");
const build = (f: Parameters<typeof buildProspectWhere>[0], resolved = {}) =>
  buildProspectWhere(f, { coldBefore, resolved });

// Helper: the builder returns { AND: [...] }; pull the clauses out for inspection.
const clauses = (f: Parameters<typeof buildProspectWhere>[0], resolved = {}) => {
  const where = build(f, resolved);
  return (where.AND ?? []) as Record<string, unknown>[];
};
const has = (f: Parameters<typeof buildProspectWhere>[0], pred: (c: Record<string, unknown>) => boolean, resolved = {}) =>
  clauses(f, resolved).some(pred);

// Unsubscribed contacts are excluded unless explicitly requested — they can never be emailed,
// so including them would silently build audiences that under-deliver.
{
  assert.ok(
    has({}, (c) => c.unsubscribedAt === null),
    "unsubscribed excluded by default"
  );
  assert.ok(
    !has({ includeUnsubscribed: true }, (c) => c.unsubscribedAt === null),
    "opt-in includes them"
  );
}

// An empty filter set must not produce a junk clause beyond the unsubscribe guard.
{
  const c = clauses({});
  assert.equal(c.length, 1, "only the unsubscribe guard");
}

// Multi-select values OR inside one filter (`in`), and separate filters AND together.
{
  const c = clauses({ seniority: ["owner", "c_level"], department: ["sales"] });
  assert.ok(c.some((x) => JSON.stringify(x) === JSON.stringify({ seniority: { in: ["owner", "c_level"] } })));
  assert.ok(c.some((x) => JSON.stringify(x) === JSON.stringify({ department: { in: ["sales"] } })));
}

// Owner + "no owner" combine as OR so "mine or unassigned" is one query.
{
  const c = clauses({ ownerIds: ["u1"], noOwner: true });
  const ownerClause = c.find((x) => Array.isArray(x.OR)) as { OR: Record<string, unknown>[] };
  assert.ok(ownerClause, "owner clause present");
  assert.equal(ownerClause.OR.length, 2);
}

// Employee buckets map to gte/lte pairs, OR-ed across selected buckets.
{
  const c = clauses({ employeeBuckets: ["1-10", "10001+"] });
  const companyClause = c.find((x) => x.company) as { company: { OR: { employeeCount: Record<string, number> }[] } };
  assert.ok(companyClause, "company clause present");
  assert.equal(companyClause.company.OR.length, 2);
  assert.deepEqual(companyClause.company.OR[0].employeeCount, { gte: 1, lte: 10 });
  assert.deepEqual(companyClause.company.OR[1].employeeCount, { gte: 10001 }, "open-ended top bucket has no lte");
}

// An unknown bucket id must not silently widen the search to everything.
{
  const c = clauses({ employeeBuckets: ["not-a-bucket"] });
  assert.ok(!c.some((x) => x.company), "unknown bucket produces no company clause");
}

// Retargeting angles OR together.
{
  const c = clauses({ engagement: ["touched_no_reply", "never_contacted"] });
  const eng = c.find((x) => Array.isArray(x.OR)) as { OR: Record<string, unknown>[] };
  assert.equal(eng.OR.length, 2);
}

// "Touched, no reply" means: in at least one campaign AND no membership has a reply.
{
  const c = clauses({ engagement: ["touched_no_reply"] });
  const eng = c.find((x) => Array.isArray(x.OR)) as { OR: { AND: Record<string, unknown>[] }[] };
  assert.equal(eng.OR[0].AND.length, 2, "both the 'was touched' and 'never replied' halves");
}

// "Cold" excludes the pre-resolved recently-active ids and guards on createdAt so brand-new
// contacts aren't mislabelled.
{
  const c = clauses({ engagement: ["cold"] }, { recentlyActiveIds: ["p1", "p2"] });
  const eng = c.find((x) => Array.isArray(x.OR)) as { OR: Record<string, { notIn?: string[]; lt?: Date }>[] };
  assert.deepEqual(eng.OR[0].id.notIn, ["p1", "p2"]);
  assert.equal(eng.OR[0].createdAt.lt, coldBefore);
}

// Custom fields resolve to an id list; with none selected no id clause appears.
{
  assert.ok(
    !has({}, (c) => c.id !== undefined),
    "no custom-field filter, no id clause"
  );
  const c = clauses(
    { customFields: [{ definitionId: "d1", mode: "in", values: ["SaaS"] }] },
    { customFieldMatchIds: ["p9"] }
  );
  assert.ok(c.some((x) => JSON.stringify(x) === JSON.stringify({ id: { in: ["p9"] } })));
}

// A custom-field filter that matched nothing must return nothing — not everything.
{
  const c = clauses({ customFields: [{ definitionId: "d1", mode: "in", values: ["Nope"] }] }, {});
  assert.ok(
    c.some((x) => JSON.stringify(x) === JSON.stringify({ id: { in: [] } })),
    "unresolved custom-field filter yields an empty id list, never an open query"
  );
}

// minContactsAtCompany only kicks in above 1, and uses the resolved company list.
{
  assert.ok(!has({ minContactsAtCompany: 1 }, (c) => c.companyId !== undefined), "1 is a no-op");
  const c = clauses({ minContactsAtCompany: 3 }, { companyIdsWithEnoughContacts: ["c1"] });
  assert.ok(c.some((x) => JSON.stringify(x) === JSON.stringify({ companyId: { in: ["c1"] } })));
}

// hasEmail / hasPhone treat an empty string as missing, not just null.
{
  const email = clauses({ hasEmail: true }).find((c) => c.email !== undefined);
  assert.deepEqual(email, { email: { not: null }, NOT: { email: "" } });

  const phone = clauses({ hasPhone: true }).find((c) => c.phone !== undefined);
  assert.deepEqual(phone, { phone: { not: null }, NOT: { phone: "" } });

  // Both together AND, so "reachable by either channel" is not what this means.
  const both = clauses({ hasEmail: true, hasPhone: true });
  assert.ok(both.some((c) => c.email !== undefined) && both.some((c) => c.phone !== undefined));
}

// Free-text search spans the fields a rep would actually type into.
{
  const c = clauses({ q: "acme" });
  const search = c.find((x) => Array.isArray(x.OR)) as { OR: Record<string, unknown>[] };
  assert.equal(search.OR.length, 5, "name, surname, email, title, company");
}

console.log("prospect-where: all assertions passed");
