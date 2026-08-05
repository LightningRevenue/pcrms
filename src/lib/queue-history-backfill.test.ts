import assert from "node:assert/strict";
import { backfillJobId } from "@/lib/queue-history-backfill";

// BullMQ throws "Custom Id cannot contain :" — and since the enqueue is deliberately
// non-fatal, that throw was invisible except as a contact stuck at "failed".
assert.ok(!backfillJobId("abc123").includes(":"));

// Still one job per person, so a re-import can't stack duplicate backfills.
assert.notEqual(backfillJobId("abc123"), backfillJobId("def456"));
assert.equal(backfillJobId("abc123"), backfillJobId("abc123"));

console.log("queue-history-backfill tests passed");
