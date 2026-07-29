import assert from "node:assert/strict";
import { setUnsubscribed } from "./gdpr";

// setUnsubscribed only touches db.person/db.activity, so a stub client is enough — no Postgres.
// The behaviour worth pinning is the no-op guard: a second click (or a mail client prefetching
// the link) must not write a duplicate timeline entry.
let updateCount = 0;
const activities: Array<Record<string, unknown>> = [];
const fakeDb = {
  person: { updateMany: async (_args: unknown) => ({ count: updateCount }) },
  activity: { create: async ({ data }: { data: unknown }) => void activities.push(data as Record<string, unknown>) },
};

// Wrapped in an IIFE: tsx transforms these tests to CJS, which has no top-level await.
async function main() {
// A real state change logs one entry, with no actor for the public unsubscribe link.
updateCount = 1;
await setUnsubscribed("p1", "w1", true, null, fakeDb);
assert.equal(activities.length, 1);
assert.equal(activities[0].kind, "unsubscribed");
assert.equal(activities[0].entityType, "person");
assert.equal(activities[0].entityId, "p1");
assert.equal(activities[0].workspaceId, "w1");
assert.equal(activities[0].actorId, null);

// Already unsubscribed → updateMany matches nothing → no second entry.
updateCount = 0;
await setUnsubscribed("p1", "w1", true, null, fakeDb);
assert.equal(activities.length, 1);

// Resubscribe by a workspace member is its own kind and credits the actor.
updateCount = 1;
await setUnsubscribed("p1", "w1", false, "u1", fakeDb);
assert.equal(activities.length, 2);
assert.equal(activities[1].kind, "resubscribed");
assert.equal(activities[1].actorId, "u1");

console.log("ok - gdpr unsubscribe timeline");
}

main();
