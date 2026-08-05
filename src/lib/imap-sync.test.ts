import assert from "node:assert/strict";
import { resolveDirection } from "@/lib/imap-sync";

const MAILBOX = "sales@acme.com";

// Inbound: the lead is the sender, so that's who the message links to.
{
  const r = resolveDirection(MAILBOX, "lead@corp.com", [MAILBOX]);
  assert.equal(r.direction, "received");
  assert.deepEqual(r.counterparties, ["lead@corp.com"]);
}

// Outbound (only reachable via backfill, which walks Sent): From is the mailbox itself, so the
// contact must be matched on the recipient instead. Getting this backwards is what would make
// prior outbound history import with no contact attached.
{
  const r = resolveDirection(MAILBOX, MAILBOX, ["lead@corp.com"]);
  assert.equal(r.direction, "sent");
  assert.deepEqual(r.counterparties, ["lead@corp.com"]);
}

// Mail servers don't preserve header casing.
{
  const r = resolveDirection(MAILBOX, "SALES@ACME.COM", ["lead@corp.com"]);
  assert.equal(r.direction, "sent");
}

// Multi-recipient outbound: every recipient is a link candidate, not just the first.
{
  const r = resolveDirection(MAILBOX, MAILBOX, ["a@corp.com", "b@corp.com"]);
  assert.deepEqual(r.counterparties, ["a@corp.com", "b@corp.com"]);
}

// Envelope with no From (malformed/bounce) must not yield an empty-string candidate — that
// would match any Person row whose email is "".
{
  const r = resolveDirection(MAILBOX, "", []);
  assert.deepEqual(r.counterparties, []);
}

console.log("imap-sync tests passed");
