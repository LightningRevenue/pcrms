// Threading helpers for campaign follow-ups: replies must keep the parent's subject and carry
// the full References chain, or clients scatter a sequence into unrelated messages.

const MAX_REFERENCES = 20;

// A reply keeps the root subject, Re:-prefixed exactly once. Clients that group by subject
// (and users skimming an inbox) treat a changed subject as a new conversation.
export function replySubject(parentSubject: string): string {
  return /^re:\s/i.test(parentSubject) ? parentSubject : `Re: ${parentSubject}`;
}

type ChainNode = { messageIdHeader: string | null; inReplyTo: string | null };

// Walks inReplyTo from the direct parent back to the thread root, returning Message-IDs
// oldest-first as the References header wants. `lookup` resolves a Message-ID to its row;
// returning null (unknown ancestor, e.g. an inbound reply we never stored) just ends the walk.
export async function buildReferences(
  parent: ChainNode | null,
  lookup: (messageId: string) => Promise<ChainNode | null>,
): Promise<string[]> {
  const references: string[] = [];
  const seen = new Set<string>();

  for (let node = parent; node?.messageIdHeader; ) {
    // A malformed inbound In-Reply-To can point back into the chain; stop rather than loop.
    if (seen.has(node.messageIdHeader)) break;
    seen.add(node.messageIdHeader);
    references.unshift(node.messageIdHeader);
    if (references.length >= MAX_REFERENCES) break;
    node = node.inReplyTo ? await lookup(node.inReplyTo) : null;
  }

  return references;
}
