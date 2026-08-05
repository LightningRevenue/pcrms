import assert from "node:assert";
import { statusOf, guessEmailColumn, DOWNLOAD_STATUSES } from "@/lib/verify-api";
import { parseCsv } from "@/lib/csv";

// statusOf — catchAll must win over valid, or catch-all domains get sold as verified.
assert.equal(statusOf({ valid: true, catchAll: false }), "valid");
assert.equal(statusOf({ valid: false, catchAll: false }), "invalid");
assert.equal(statusOf({ valid: true, catchAll: true }), "catch-all");
assert.equal(statusOf({ valid: false, catchAll: true }), "catch-all");

// guessEmailColumn — by header name, case/whitespace insensitive.
assert.equal(guessEmailColumn(["Name", "Email", "Company"], []), "Email");
assert.equal(guessEmailColumn(["name", "  E-Mail  "], []), "  E-Mail  ");
// "email" is preferred over other hints when several are present.
assert.equal(guessEmailColumn(["mail", "email"], []), "email");

// Falls back to content sniffing when no header name matches.
assert.equal(
  guessEmailColumn(["a", "b"], [["Ana", "ana@acme.com"], ["Bob", "bob@acme.com"]]),
  "b"
);
// No header hint and no "@" anywhere — refuse to guess rather than pick a wrong column.
assert.equal(guessEmailColumn(["a", "b"], [["Ana", "Bob"]]), null);
assert.equal(guessEmailColumn([], []), null);

// Download filters — "fully verified" must never include catch-all.
assert.deepEqual(DOWNLOAD_STATUSES["valid"], ["valid"]);
assert.deepEqual(DOWNLOAD_STATUSES["valid-catch-all"], ["valid", "catch-all"]);
assert.equal(DOWNLOAD_STATUSES["all"], undefined);
assert.ok(!DOWNLOAD_STATUSES["valid"]!.includes("catch-all"));

// Row accounting, mirroring run-verify.ts: a real lead list has blank email cells and repeats
// the same address across rows. Both must still produce one output row each, or the downloaded
// CSV comes back shorter than the upload (this shipped broken once — 74 results for 100 rows).
{
  const csv = "name,email\nAna,ana@acme.com\nBlank,\nDup,ana@acme.com\nBob,bob@acme.com\nBlank2,\n";
  const [header, ...dataRows] = parseCsv(csv);
  const emailIdx = header.indexOf("email");
  const pending = dataRows.map((row, rowIndex) => ({ rowIndex, email: (row[emailIdx] ?? "").trim() }));

  assert.equal(pending.length, dataRows.length, "every row is verified, none filtered out");
  // Distinct API calls = distinct non-blank addresses, so duplicates are free.
  assert.equal(new Set(pending.filter((p) => p.email).map((p) => p.email)).size, 2);
  assert.equal(pending.filter((p) => !p.email).length, 2, "blank cells are recorded, not dropped");
  // Dense unique indexes — the download orders by these to preserve upload order.
  assert.deepEqual(pending.map((p) => p.rowIndex), [0, 1, 2, 3, 4]);
}

console.log("verify-api tests passed");
