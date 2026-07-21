"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace, personVisibilityFilter } from "@/lib/workspace";
import { db } from "@/lib/db";
import { runImapPollAll } from "@/lib/imap-sync";

export async function listInboxThreads() {
  const ctx = await requireWorkspace();
  const { workspaceId } = ctx;

  // A plain member only sees threads tied to a contact they own — unowned/other-owner
  // mail (e.g. unrecognized IMAP senders) drops out for them, same rule as the CRM views.
  const personFilter = personVisibilityFilter(ctx);
  const emails = await db.email.findMany({
    where: {
      workspaceId,
      ...(Object.keys(personFilter).length ? { person: personFilter } : {}),
    },
    orderBy: { sentAt: "asc" },
    include: {
      person: { select: { id: true, firstName: true, lastName: true, email: true, companyId: true } },
      opens: true,
      campaignMember: { select: { campaign: { select: { id: true, name: true } } } },
    },
  });

  // Root of an email's thread: gmailThreadId when set (Gmail already threads these), otherwise
  // walk the In-Reply-To chain back to the first message with no resolvable parent, and use
  // that root message's id as the grouping key — this is what threads SMTP/IMAP replies together.
  const byMessageId = new Map(emails.filter((e) => e.messageIdHeader).map((e) => [e.messageIdHeader as string, e]));

  function threadRootId(email: (typeof emails)[number], depth = 0): string {
    if (email.gmailThreadId) return email.gmailThreadId;
    if (depth > 50 || !email.inReplyTo) return email.id;
    const parent = byMessageId.get(email.inReplyTo);
    if (!parent || parent.id === email.id) return email.id;
    return threadRootId(parent, depth + 1);
  }

  const threads = new Map<string, typeof emails>();
  for (const email of emails) {
    const key = threadRootId(email);
    const list = threads.get(key);
    if (list) list.push(email);
    else threads.set(key, [email]);
  }

  return Array.from(threads.entries())
    .map(([threadId, messages]) => ({ threadId, messages }))
    .sort((a, b) => {
      const aLast = a.messages[a.messages.length - 1].sentAt.getTime();
      const bLast = b.messages[b.messages.length - 1].sentAt.getTime();
      return bLast - aLast;
    });
}

export type InboxThread = Awaited<ReturnType<typeof listInboxThreads>>[number];

export async function syncInboxNow() {
  await requireWorkspace();

  const found = await runImapPollAll();
  revalidatePath("/inbox");
  return found;
}

export async function searchContactsForCompose(query: string) {
  const { workspaceId } = await requireWorkspace();
  const q = query.trim();
  if (!q) return [];
  const people = await db.person.findMany({
    where: {
      workspaceId,
      email: { not: null },
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { firstName: "asc" },
    take: 8,
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  return people.map((p) => ({
    id: p.id,
    name: [p.firstName, p.lastName].filter(Boolean).join(" "),
    email: p.email as string,
  }));
}
