import { db } from "@/lib/db";
import { fetchThreadMessages } from "@/lib/gmail";
import { publishNotification } from "@/lib/redis";
import { sendReplyEmailNotification } from "@/lib/reply-notification";
import { cancelActiveEmailStepsOnReply } from "@/lib/sequence-runner";

// ponytail: direction inferred from Gmail's own SENT label — no per-account address matching needed
function directionFromLabels(labelIds: string[]): "sent" | "received" {
  return labelIds.includes("SENT") ? "sent" : "received";
}

export async function syncGmailThread(
  userId: string,
  gmailThreadId: string,
  personId: string,
  workspaceId: string,
  // Backfilled history is not a new reply: importing an old conversation must not cancel live
  // sequence steps or raise "New reply from…" for a thread that ended months ago.
  opts: { silent?: boolean } = {}
) {
  const messages = await fetchThreadMessages(userId, gmailThreadId);
  const existing = await db.email.findMany({
    where: { workspaceId, gmailThreadId },
    select: { gmailMessageId: true, personId: true },
  });
  const existingIds = new Set(existing.map((e) => e.gmailMessageId));

  const newMessages = messages.filter((m) => !existingIds.has(m.gmailMessageId));

  // A message imported earlier is skipped above, which used to mean a backfill for a contact
  // added *after* that import found the thread and linked nothing — the mail was in the DB but
  // invisible on the contact's Emails tab. Claim any row on this thread that isn't attached to a
  // contact yet. Rows already linked to someone are left alone, so this can't steal a thread
  // from the contact it legitimately belongs to.
  const unlinked = existing.filter((e) => !e.personId).length;
  if (unlinked > 0) {
    await db.email.updateMany({
      where: { workspaceId, gmailThreadId, personId: null },
      data: { personId },
    });
  }

  // Reply inheritance: any deal(s) already linked to an earlier email in this thread
  // carry over to every new message on the same thread, so a reply lands on the same deal.
  const threadOpportunityIds = newMessages.length
    ? (
        await db.emailOpportunity.findMany({
          where: { workspaceId, email: { gmailThreadId } },
          select: { opportunityId: true },
          distinct: ["opportunityId"],
        })
      ).map((r) => r.opportunityId)
    : [];

  for (const m of newMessages) {
    const direction = directionFromLabels(m.labelIds);
    const email = await db.email.create({
      data: {
        workspaceId,
        gmailMessageId: m.gmailMessageId,
        gmailThreadId: m.gmailThreadId,
        messageIdHeader: m.messageIdHeader,
        direction,
        from: m.from,
        to: m.to,
        cc: m.cc,
        bcc: [],
        subject: m.subject,
        bodyHtml: m.bodyHtml,
        sentAt: m.internalDate,
        personId,
        opportunities: threadOpportunityIds.length
          ? { createMany: { data: threadOpportunityIds.map((opportunityId) => ({ workspaceId, opportunityId })) } }
          : undefined,
      },
    });

    if (direction === "received" && !opts.silent) {
      await cancelActiveEmailStepsOnReply(personId, workspaceId);

      const person = await db.person.findUnique({ where: { id: personId, workspaceId } });
      const personName = person ? [person.firstName, person.lastName].filter(Boolean).join(" ") : m.from;

      const notification = await db.notification.create({
        data: {
          workspaceId,
          userId,
          kind: "email_reply",
          title: `New reply from ${personName}`,
          body: m.subject,
          link: `/contacts/${personId}?tab=emails&emailId=${email.id}`,
        },
      });

      await publishNotification(userId, notification);
      await sendReplyEmailNotification({ personId, subject: m.subject, workspaceId });
    }
  }

  // Adopted rows count as found: from the caller's perspective they're mail that just became
  // visible on this contact, same as a freshly imported one.
  return newMessages.length + unlinked;
}

export async function syncPersonEmailThreads(userId: string, personId: string, workspaceId: string) {
  const threadIds = await db.email.findMany({
    where: { workspaceId, personId, gmailThreadId: { not: null } },
    select: { gmailThreadId: true },
    distinct: ["gmailThreadId"],
  });

  let total = 0;
  for (const { gmailThreadId } of threadIds) {
    if (!gmailThreadId) continue;
    total += await syncGmailThread(userId, gmailThreadId, personId, workspaceId);
  }
  return total;
}

const CRON_JOB_NAME = "gmail-reply-sync";

export async function runGmailReplySync() {
  const run = await db.cronJobRun.create({
    data: { job: CRON_JOB_NAME, status: "running" },
  });

  let emailsFound = 0;
  try {
    const accounts = await db.account.findMany({ where: { provider: "google" } });

    for (const account of accounts) {
      // Not scoped by workspaceId here — this cron job runs globally across every workspace's
      // connected Gmail accounts, same as runImapPollAll. Each Person carries its own
      // workspaceId, which is what actually scopes the sync/create calls below.
      const people = await db.email.findMany({
        where: { senderId: account.userId, gmailThreadId: { not: null }, personId: { not: null } },
        select: { personId: true, workspaceId: true },
        distinct: ["personId"],
      });

      for (const { personId, workspaceId } of people) {
        if (!personId) continue;
        emailsFound += await syncPersonEmailThreads(account.userId, personId, workspaceId);
      }
    }

    await db.cronJobRun.update({
      where: { id: run.id },
      data: { status: "success", finishedAt: new Date(), emailsFound },
    });
  } catch (err) {
    await db.cronJobRun.update({
      where: { id: run.id },
      data: {
        status: "error",
        finishedAt: new Date(),
        emailsFound,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }

  return emailsFound;
}
