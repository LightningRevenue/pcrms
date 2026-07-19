"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { runImapPollAll } from "@/lib/imap-sync";

export async function listInboxThreads() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const emails = await db.email.findMany({
    orderBy: { sentAt: "asc" },
    include: {
      person: { select: { id: true, firstName: true, lastName: true, email: true, companyId: true } },
      opens: true,
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
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const found = await runImapPollAll();
  revalidatePath("/inbox");
  return found;
}

export async function searchContactsForCompose(query: string) {
  const q = query.trim();
  if (!q) return [];
  const people = await db.person.findMany({
    where: {
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
