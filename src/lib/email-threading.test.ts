import assert from "node:assert/strict";
import { replySubject, buildReferences } from "./email-threading";

// Subject: prefixed once, never stacked into "Re: Re: Re:".
assert.equal(replySubject("Quick question"), "Re: Quick question");
assert.equal(replySubject("Re: Quick question"), "Re: Quick question");
assert.equal(replySubject("RE: Quick question"), "RE: Quick question");
// "Recap" starts with "re" but isn't a reply prefix — needs the space to match.
assert.equal(replySubject("Recap of our call"), "Re: Recap of our call");

// A chain of three campaign sends, newest last.
const thread: Record<string, { messageIdHeader: string | null; inReplyTo: string | null }> = {
  "<s1@mail>": { messageIdHeader: "<s1@mail>", inReplyTo: null },
  "<s2@mail>": { messageIdHeader: "<s2@mail>", inReplyTo: "<s1@mail>" },
  "<s3@mail>": { messageIdHeader: "<s3@mail>", inReplyTo: "<s2@mail>" },
};
const lookup = async (id: string) => thread[id] ?? null;

async function main() {
  // Step 1 has no parent — no References at all.
  assert.deepEqual(await buildReferences(null, lookup), []);
  // Step 2 references only step 1.
  assert.deepEqual(await buildReferences(thread["<s1@mail>"], lookup), ["<s1@mail>"]);
  // Step 4 references the whole chain, oldest first — the bug this fixes was only ever
  // emitting the direct parent here.
  assert.deepEqual(await buildReferences(thread["<s3@mail>"], lookup), [
    "<s1@mail>",
    "<s2@mail>",
    "<s3@mail>",
  ]);

  // An ancestor we never stored (inbound reply from outside the CRM) ends the walk cleanly
  // instead of throwing.
  const orphan = { messageIdHeader: "<s2@mail>", inReplyTo: "<never-seen@elsewhere>" };
  assert.deepEqual(await buildReferences(orphan, lookup), ["<s2@mail>"]);

  // Malformed headers pointing back into the chain must not spin forever.
  const cyclic: Record<string, { messageIdHeader: string | null; inReplyTo: string | null }> = {
    "<a@mail>": { messageIdHeader: "<a@mail>", inReplyTo: "<b@mail>" },
    "<b@mail>": { messageIdHeader: "<b@mail>", inReplyTo: "<a@mail>" },
  };
  assert.deepEqual(await buildReferences(cyclic["<a@mail>"], async (id) => cyclic[id] ?? null), [
    "<b@mail>",
    "<a@mail>",
  ]);

  console.log("email-threading: ok");
}

main();
