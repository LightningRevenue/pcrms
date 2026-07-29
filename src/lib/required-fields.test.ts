import assert from "node:assert/strict";
import {
  activeRequiredFields,
  missingRequiredFields,
  parseRequiredFields,
  requiredFieldsError,
  serializeRequiredFields,
  REQUIRED_FIELDS_OFF,
} from "./required-fields";
import { STANDARD_IMPORT_FIELDS, guessMapping, withRequiredFields } from "./import-fields";
import { exampleCsv } from "./import-example";
import { parseCsv } from "./csv";

// Unset / malformed config never enforces anything — a bad JSON row must not lock people out of
// creating contacts.
assert.deepEqual(parseRequiredFields(null), REQUIRED_FIELDS_OFF);
assert.deepEqual(parseRequiredFields("not json"), REQUIRED_FIELDS_OFF);
assert.deepEqual(parseRequiredFields("[1,2]"), REQUIRED_FIELDS_OFF);

// Keys that no longer exist are dropped on read, so a stale config can't demand an unfillable field.
assert.deepEqual(parseRequiredFields('{"enforced":true,"keys":["email","ghostField"]}'), {
  enforced: true,
  keys: ["email"],
});

assert.deepEqual(parseRequiredFields(serializeRequiredFields({ enforced: true, keys: ["email", "nope"] })), {
  enforced: true,
  keys: ["email"],
});

// The enforce toggle gates everything: keys stay saved but inactive while it's off.
assert.deepEqual(activeRequiredFields({ enforced: false, keys: ["email"] }), []);
assert.equal(activeRequiredFields({ enforced: true, keys: ["email"] }).length, 1);

const config = { enforced: true, keys: ["email", "jobTitle", "industry"] };

assert.deepEqual(missingRequiredFields({ email: "a@b.com", jobTitle: "CTO", industry: "Fintech" }, config), []);
// Whitespace is not a value.
assert.deepEqual(missingRequiredFields({ email: "a@b.com", jobTitle: "   ", industry: "Fintech" }, config), ["Job Title"]);
assert.deepEqual(missingRequiredFields({}, config), ["Email", "Job Title", "Industry"]);
// Nothing is enforced while the toggle is off, whatever the keys say.
assert.deepEqual(missingRequiredFields({}, { enforced: false, keys: ["email"] }), []);

assert.equal(requiredFieldsError(["Email"]), "Email is required");
assert.equal(requiredFieldsError(["Email", "Industry"]), "Email, Industry are required");

// withRequiredFields overlays config onto the static list without losing firstName's built-in rule.
const personFields = withRequiredFields(STANDARD_IMPORT_FIELDS.person, ["industry"]);
assert.equal(personFields.find((f) => f.key === "firstName")?.required, true);
assert.equal(personFields.find((f) => f.key === "industry")?.required, true);
assert.equal(personFields.find((f) => f.key === "phone")?.required, undefined);

// The example CSV must survive its own round trip: every required column is marked, carries a
// value in each sample row, and still auto-maps back to its field despite the "(required)" suffix.
const csv = exampleCsv("person", ["email", "industry"]);
const [header, ...rows] = parseCsv(csv);
assert.ok(header.includes("Email (required)"));
assert.ok(header.includes("Industry (required)"));
assert.ok(header.includes("Phone"));

const mapping = guessMapping(header, personFields);
assert.equal(mapping["Email (required)"], "email");
assert.equal(mapping["Industry (required)"], "industry");

// Header order and value order can't drift apart — that was a real bug in the positional version.
const emailIdx = header.indexOf("Email (required)");
const industryIdx = header.indexOf("Industry (required)");
for (const row of rows) {
  assert.ok(row[emailIdx].includes("@"), `expected an email, got "${row[emailIdx]}"`);
  assert.ok(row[industryIdx].trim().length > 0, "required column must never be blank in the sample");
}

// A row from the sample file passes the validator it will be imported under.
const record = Object.fromEntries(
  header.map((h, i) => [mapping[h], rows[0][i]]).filter(([k]) => k)
) as Record<string, string>;
assert.deepEqual(missingRequiredFields(record, { enforced: true, keys: ["email", "industry"] }), []);

console.log("required-fields: all assertions passed");
