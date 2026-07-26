"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace, personVisibilityFilter } from "@/lib/workspace";
import { db } from "@/lib/db";
import { runImapPollAll } from "@/lib/imap-sync";
import type { Prisma } from "@prisma/client";
import { INBOX_PAGE_SIZE, type InboxFilters } from "@/lib/inbox-filters";

export async function listInboxThreads(filters: InboxFilters = {}) {
  const ctx = await requireWorkspace();
  const { workspaceId } = ctx;

  // A plain member only sees threads tied to a contact they own — unowned/other-owner
  // mail (e.g. unrecognized IMAP senders) drops out for them, same rule as the CRM views.
  const personFilter = personVisibilityFilter(ctx);

  // Narrow in SQL on everything that's a plain column/relation match. The thread-level
  // predicates (unanswered, search, direction) need the full thread assembled, so they run
  // after grouping — but this WHERE is what keeps us from loading the whole workspace.
  const where: Prisma.EmailWhereInput = {
    workspaceId,
    ...(Object.keys(personFilter).length ? { person: personFilter } : {}),
  };
  if (filters.days) {
    where.sentAt = { gte: new Date(Date.now() - filters.days * 86_400_000) };
  }
  if (filters.mailboxIds?.length) where.mailboxAccountId = { in: filters.mailboxIds };
  if (filters.campaignIds?.length) {
    where.campaignMember = { campaignId: { in: filters.campaignIds } };
  }
  if (filters.linked === "linked") where.personId = { not: null };
  if (filters.linked === "unlinked") where.personId = null;
  if (filters.ownerIds?.length) {
    where.person = { ...(where.person as object), ownerId: { in: filters.ownerIds } };
  }
  if (filters.companyIds?.length) {
    where.person = { ...(where.person as object), companyId: { in: filters.companyIds } };
  }
  if (filters.opened) where.opens = { some: {} };

  const emails = await db.email.findMany({
    where,
    orderBy: { sentAt: "asc" },
    include: {
      person: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          companyId: true,
          ownerId: true,
          company: { select: { id: true, name: true } },
        },
      },
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

  const q = filters.q?.trim().toLowerCase();
  const tab = filters.tab ?? "received";

  const all = Array.from(threads.entries())
    .map(([threadId, messages]) => ({ threadId, messages }))
    .filter(({ messages }) => {
      // A thread with messages in both directions belongs in every tab its messages qualify
      // for — "does this conversation have a message like that", not "what was the last
      // message" (otherwise a thread you started vanishes from Sent the moment someone replies).
      if (tab === "received" && !messages.some((m) => m.direction === "received")) return false;
      if (tab === "sent" && !messages.some((m) => m.direction === "sent")) return false;

      if (filters.unanswered && messages[messages.length - 1].direction !== "sent") return false;

      if (q) {
        const last = messages[messages.length - 1];
        const name = [last.person?.firstName, last.person?.lastName].filter(Boolean).join(" ");
        const haystack = `${last.subject} ${name} ${last.person?.email ?? last.from}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aLast = a.messages[a.messages.length - 1].sentAt.getTime();
      const bLast = b.messages[b.messages.length - 1].sentAt.getTime();
      return bLast - aLast;
    });

  // ponytail: threads are grouped in JS, so the page slice happens here rather than in SQL.
  // Persist a threadId column on Email at insert time if this ever needs real DB paging.
  const page = Math.max(1, filters.page ?? 1);
  return {
    threads: all.slice((page - 1) * INBOX_PAGE_SIZE, page * INBOX_PAGE_SIZE),
    total: all.length,
  };
}

export type InboxThread = Awaited<ReturnType<typeof listInboxThreads>>["threads"][number];

/** Filter dropdown options — owners/companies/campaigns that actually appear on mail. */
export async function listInboxFilterOptions() {
  const ctx = await requireWorkspace();
  const { workspaceId } = ctx;
  const personFilter = personVisibilityFilter(ctx);
  const people = await db.person.findMany({
    where: { workspaceId, ...personFilter, emails: { some: {} } },
    select: {
      owner: { select: { id: true, name: true, email: true } },
      company: { select: { id: true, name: true } },
    },
  });
  const campaigns = await db.campaign.findMany({
    where: { workspaceId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const owners = new Map<string, { id: string; name: string | null; email: string | null }>();
  const companies = new Map<string, { id: string; name: string }>();
  for (const p of people) {
    if (p.owner) owners.set(p.owner.id, p.owner);
    if (p.company) companies.set(p.company.id, { id: p.company.id, name: p.company.name || "Untitled" });
  }
  return {
    owners: Array.from(owners.values()).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
    companies: Array.from(companies.values()).sort((a, b) => a.name.localeCompare(b.name)),
    campaigns,
  };
}

/**
 * Everything the inbox's lead side-panel shows for one contact. Loaded on demand when the
 * panel opens, not with the thread list — most conversations never get previewed.
 */
export async function getInboxLeadContext(personId: string) {
  const ctx = await requireWorkspace();
  const { workspaceId } = ctx;

  const person = await db.person.findFirst({
    where: { id: personId, workspaceId, ...personVisibilityFilter(ctx) },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      jobTitle: true,
      linkedin: true,
      createdAt: true,
      owner: { select: { id: true, name: true, email: true } },
      company: { select: { id: true, name: true, domain: true } },
      opportunityLinks: { select: { opportunityId: true } },
    },
  });
  if (!person) return null;

  const linkedIds = person.opportunityLinks.map((l) => l.opportunityId);
  const [opportunities, tasks, notes, stages] = await Promise.all([
    db.opportunity.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        OR: [{ contactId: personId }, { id: { in: linkedIds } }],
      },
      select: {
        id: true,
        name: true,
        value: true,
        stage: true,
        expectedCloseDate: true,
        closeDate: true,
        owner: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.task.findMany({
      where: { personId, workspaceId, done: false },
      select: { id: true, title: true, dueAt: true, type: true },
      orderBy: { dueAt: "asc" },
      take: 5,
    }),
    db.note.findMany({
      where: { personId, workspaceId },
      select: { id: true, body: true, createdAt: true, createdBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    db.pipelineStage.findMany({
      where: { workspaceId },
      select: { label: true, outcome: true },
      orderBy: { order: "asc" },
    }),
  ]);

  return { person, opportunities, tasks, notes, stages };
}

export type InboxLeadContext = NonNullable<Awaited<ReturnType<typeof getInboxLeadContext>>>;

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
    select: { id: true, firstName: true, lastName: true, email: true, unsubscribedAt: true },
  });
  return people.map((p) => ({
    id: p.id,
    name: [p.firstName, p.lastName].filter(Boolean).join(" "),
    email: p.email as string,
    unsubscribed: !!p.unsubscribedAt,
  }));
}
