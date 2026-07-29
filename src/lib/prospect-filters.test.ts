import assert from "node:assert/strict";
import {
  matchesProspectFilters,
  normalizeProspectFilters,
  prospectFiltersEqual,
  type MatchablePerson,
  type ProspectFilters,
} from "./prospect-filters";

const person = (over: Partial<MatchablePerson> = {}): MatchablePerson => ({
  id: "p1",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  phone: "+40700000000",
  jobTitle: "Head of Engineering",
  seniority: "head",
  department: "engineering",
  stage: "Qualified",
  ownerId: "u1",
  createdAt: new Date("2020-01-01T00:00:00Z"),
  unsubscribedAt: null,
  emailVerifiedStatus: "valid",
  importBatchId: "b1",
  companyId: "c1",
  companyName: "Analytical Engines",
  industry: "software",
  country: "RO",
  revenueRange: "1M-10M",
  employeeCount: 120,
  campaignIds: ["camp1"],
  hasCampaignReply: false,
  lastActivityAt: new Date("2020-06-01T00:00:00Z"),
  customValues: { def1: "gold" },
  contactsAtCompany: 3,
  ...over,
});

const match = (f: ProspectFilters, over: Partial<MatchablePerson> = {}) =>
  matchesProspectFilters(person(over), f);

// --- prospectFiltersEqual ---------------------------------------------------------------

// Representation noise must not read as "unsaved changes" in the Contacts save bar.
{
  assert.ok(prospectFiltersEqual({}, {}), "empty equals empty");
  assert.ok(
    prospectFiltersEqual({ stage: ["a"], seniority: ["b"] }, { seniority: ["b"], stage: ["a"] }),
    "key order ignored"
  );
  assert.ok(prospectFiltersEqual({ stage: [] }, {}), "empty array equals undefined");
  assert.ok(prospectFiltersEqual({ hasEmail: false }, {}), "false equals undefined");
  assert.ok(prospectFiltersEqual({ q: "  " }, {}), "blank query equals undefined");
  assert.ok(
    prospectFiltersEqual({ ownerIds: ["u2", "u1"] }, { ownerIds: ["u1", "u2"] }),
    "value order inside a multi-select ignored"
  );
  assert.ok(prospectFiltersEqual({ page: 3 }, { page: 1 }), "page is not part of a view");
  assert.ok(
    prospectFiltersEqual(
      { customFields: [{ definitionId: "b", mode: "in", values: ["2", "1"] }, { definitionId: "a", mode: "set", values: [] }] },
      { customFields: [{ definitionId: "a", mode: "set", values: [] }, { definitionId: "b", mode: "in", values: ["1", "2"] }] }
    ),
    "custom field order ignored"
  );
}

// Real differences must still register.
{
  assert.ok(!prospectFiltersEqual({ stage: ["a"] }, { stage: ["b"] }), "different values differ");
  assert.ok(!prospectFiltersEqual({ hasEmail: true }, {}), "set flag differs from unset");
  assert.ok(!prospectFiltersEqual({ noOwner: true }, { ownerIds: ["u1"] }), "distinct owner filters differ");
}

// coldDays only matters while the "cold" angle is selected, so it must not cause phantom diffs.
{
  assert.ok(prospectFiltersEqual({ coldDays: 30 }, { coldDays: 180 }), "coldDays ignored without the cold angle");
  assert.ok(
    !prospectFiltersEqual({ engagement: ["cold"], coldDays: 30 }, { engagement: ["cold"], coldDays: 180 }),
    "coldDays counts once cold is selected"
  );
}

// normalize drops noise rather than rewriting meaning.
{
  const n = normalizeProspectFilters({ stage: [], hasPhone: false, seniority: ["z", "a"], page: 9 });
  assert.deepEqual(n, { seniority: ["a", "z"] }, "only meaningful keys survive");
}

// --- matchesProspectFilters -------------------------------------------------------------

// Unsubscribed contacts are excluded unless asked for — mirrors buildProspectWhere.
{
  assert.ok(!match({}, { unsubscribedAt: new Date() }), "unsubscribed hidden by default");
  assert.ok(match({ includeUnsubscribed: true }, { unsubscribedAt: new Date() }), "opt-in shows them");
  assert.ok(match({}), "no filters matches a normal contact");
}

// Multi-select values OR within a filter; separate filters AND.
{
  assert.ok(match({ seniority: ["head", "c_level"] }), "value in the selected set");
  assert.ok(!match({ seniority: ["c_level"] }), "value outside the set");
  assert.ok(match({ seniority: ["head"], department: ["engineering"] }), "both filters satisfied");
  assert.ok(!match({ seniority: ["head"], department: ["sales"] }), "one filter failing rejects");
  assert.ok(!match({ seniority: ["head"] }, { seniority: null }), "null never matches a selection");
}

// Owner: explicit ids and "no owner" OR together.
{
  assert.ok(match({ ownerIds: ["u1"] }), "owned by a selected user");
  assert.ok(!match({ ownerIds: ["u2"] }), "owned by someone else");
  assert.ok(match({ noOwner: true }, { ownerId: null }), "unassigned matches noOwner");
  assert.ok(!match({ noOwner: true }), "assigned fails noOwner alone");
  assert.ok(match({ ownerIds: ["u1"], noOwner: true }), "mine-or-unassigned: mine");
  assert.ok(match({ ownerIds: ["u2"], noOwner: true }, { ownerId: null }), "mine-or-unassigned: unassigned");
}

// Empty strings count as missing, same as buildProspectWhere's NOT: "" guard.
{
  assert.ok(match({ hasEmail: true }), "real email passes");
  assert.ok(!match({ hasEmail: true }, { email: "" }), "blank email is missing");
  assert.ok(!match({ hasEmail: true }, { email: null }), "null email is missing");
  assert.ok(!match({ hasPhone: true }, { phone: "" }), "blank phone is missing");
}

// Free-text search spans name, email, job title and company.
{
  assert.ok(match({ q: "ada" }), "matches first name, case-insensitive");
  assert.ok(match({ q: "Analytical" }), "matches company name");
  assert.ok(match({ q: "engineering" }), "matches job title");
  assert.ok(!match({ q: "babbage" }), "no field contains the term");
}

// Company-level filters read through the primary company.
{
  assert.ok(match({ industry: ["software"] }));
  assert.ok(!match({ country: ["DE"] }));
  assert.ok(match({ employeeBuckets: ["51-200"] }), "headcount inside the bucket");
  assert.ok(!match({ employeeBuckets: ["1-10"] }), "headcount outside the bucket");
  assert.ok(match({ employeeBuckets: ["10001+"] }, { employeeCount: 20000 }), "open-ended top bucket");
  assert.ok(!match({ employeeBuckets: ["51-200"] }, { employeeCount: null }), "unknown headcount never matches");
}

// minContactsAtCompany counts Person rows this CRM holds, and 1 is a no-op threshold.
{
  assert.ok(match({ minContactsAtCompany: 3 }), "meets the threshold");
  assert.ok(!match({ minContactsAtCompany: 4 }), "below the threshold");
  assert.ok(match({ minContactsAtCompany: 1 }, { contactsAtCompany: 1 }), "threshold of 1 filters nothing");
  assert.ok(!match({ minContactsAtCompany: 2 }, { companyId: null, contactsAtCompany: 0 }), "no company fails");
}

// Retargeting angles OR between themselves.
{
  assert.ok(match({ engagement: ["touched_no_reply"] }), "in a campaign, no reply");
  assert.ok(!match({ engagement: ["touched_no_reply"] }, { hasCampaignReply: true }), "replied, so not re-engageable");
  assert.ok(!match({ engagement: ["touched_no_reply"] }, { campaignIds: [] }), "never in a campaign");
  assert.ok(match({ engagement: ["never_contacted"] }, { campaignIds: [] }), "never contacted");
  assert.ok(
    match({ engagement: ["never_contacted", "touched_no_reply"] }),
    "matching either selected angle is enough"
  );
}

// "cold" needs both no recent activity and enough age to have gone quiet.
{
  const old = new Date("2020-01-01T00:00:00Z");
  assert.ok(match({ engagement: ["cold"] }, { lastActivityAt: old, createdAt: old }), "quiet and old");
  assert.ok(match({ engagement: ["cold"] }, { lastActivityAt: null, createdAt: old }), "never active and old");
  assert.ok(
    !match({ engagement: ["cold"] }, { lastActivityAt: new Date(), createdAt: old }),
    "recent activity is not cold"
  );
  assert.ok(
    !match({ engagement: ["cold"] }, { lastActivityAt: null, createdAt: new Date() }),
    "brand-new contact has not gone cold"
  );
}

// Custom fields: AND across fields, OR within one; set/unset check presence.
{
  assert.ok(match({ customFields: [{ definitionId: "def1", mode: "in", values: ["gold", "silver"] }] }));
  assert.ok(!match({ customFields: [{ definitionId: "def1", mode: "in", values: ["silver"] }] }));
  assert.ok(match({ customFields: [{ definitionId: "def1", mode: "set", values: [] }] }), "value present");
  assert.ok(!match({ customFields: [{ definitionId: "def2", mode: "set", values: [] }] }), "missing field is not set");
  assert.ok(match({ customFields: [{ definitionId: "def2", mode: "unset", values: [] }] }), "absent counts as unset");
  assert.ok(!match({ customFields: [{ definitionId: "def1", mode: "unset", values: [] }] }), "present is not unset");
  assert.ok(
    !match({ customFields: [{ definitionId: "def1", mode: "set", values: [] }] }, { customValues: { def1: "" } }),
    "blank value counts as unset"
  );
  assert.ok(
    !match({
      customFields: [
        { definitionId: "def1", mode: "in", values: ["gold"] },
        { definitionId: "def2", mode: "set", values: [] },
      ],
    }),
    "every custom field filter must hold"
  );
}

console.log("prospect-filters.test.ts passed");
