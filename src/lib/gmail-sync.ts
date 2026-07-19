import { db } from "@/lib/db";
import { fetchThreadMessages } from "@/lib/gmail";
import { publishNotification } from "@/lib/redis";
import { sendReplyEmailNotification } from "@/lib/reply-notification";

// ponytail: direction inferred from Gmail's own SENT label — no per-account address matching needed
function directionFromLabels(labelIds: string[]): "sent" | "received" {
  return labelIds.includes("SENT") ? "sent" : "received";
}

export async function syncGmailThread(userId: string, gmailThreadId: string, personId: string) {
  const messages = await fetchThreadMessages(userId, gmailThreadId);
  const existing = await db.email.findMany({
    where: { gmailThreadId },
    select: { gmailMessageId: true },
  });
  const existingIds = new Set(existing.map((e) => e.gmailMessageId));

  const newMessages = messages.filter((m) => !existingIds.has(m.gmailMessageId));

  // Reply inheritance: any deal(s) already linked to an earlier email in this thread
  // carry over to every new message on the same thread, so a reply lands on the same deal.
  const threadOpportunityIds = newMessages.length
    ? (
        await db.emailOpportunity.findMany({
          where: { email: { gmailThreadId } },
          select: { opportunityId: true },
          distinct: ["opportunityId"],
        })
      ).map((r) => r.opportunityId)
    : [];

  for (const m of newMessages) {
    const direction = directionFromLabels(m.labelIds);
    const email = await db.email.create({
      data: {
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
          ? { createMany: { data: threadOpportunityIds.map((opportunityId) => ({ opportunityId })) } }
          : undefined,
      },
    });

    if (direction === "received") {
      const person = await db.person.findUnique({ where: { id: personId } });
      const personName = person ? [person.firstName, person.lastName].filter(Boolean).join(" ") : m.from;

      const notification = await db.notification.create({
        data: {
          userId,
          kind: "email_reply",
          title: `New reply from ${personName}`,
          body: m.subject,
          link: `/contacts/${personId}?tab=emails&emailId=${email.id}`,
        },
      });

      await publishNotification(userId, notification);
      await sendReplyEmailNotification({ personId, subject: m.subject });
    }
  }

  return newMessages.length;
}

export async function syncPersonEmailThreads(userId: string, personId: string) {
  const threadIds = await db.email.findMany({
    where: { personId, gmailThreadId: { not: null } },
    select: { gmailThreadId: true },
    distinct: ["gmailThreadId"],
  });

  let total = 0;
  for (const { gmailThreadId } of threadIds) {
    if (!gmailThreadId) continue;
    total += await syncGmailThread(userId, gmailThreadId, personId);
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
      const people = await db.email.findMany({
        where: { senderId: account.userId, gmailThreadId: { not: null }, personId: { not: null } },
        select: { personId: true },
        distinct: ["personId"],
      });

      for (const { personId } of people) {
        if (!personId) continue;
        emailsFound += await syncPersonEmailThreads(account.userId, personId);
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
