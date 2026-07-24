"use server";

import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";

export type InboxPlacementRow = {
  mailboxAccountId: string;
  label: string;
  email: string;
  sentToday: number;
  sentThisWeek: number;
  sentThisMonth: number;
  replyRatePct: number | null; // null when nothing's sent — no denominator
  failureRatePct: number | null; // proxy for bounce rate: send-time SMTP failures, not async bounces
  unsubscribeRatePct: number | null;
};

function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek() {
  const d = startOfDay();
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
  return d;
}

function startOfMonth() {
  const d = startOfDay();
  d.setDate(1);
  return d;
}

export async function listInboxPlacements(): Promise<InboxPlacementRow[]> {
  const { workspaceId } = await requireWorkspace();

  const mailboxes = await db.mailboxAccount.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    select: { id: true, label: true, email: true },
  });
  if (mailboxes.length === 0) return [];

  const dayStart = startOfDay();
  const weekStart = startOfWeek();
  const monthStart = startOfMonth();

  const sent = await db.email.findMany({
    where: { workspaceId, direction: "sent", mailboxAccountId: { in: mailboxes.map((m) => m.id) } },
    select: {
      mailboxAccountId: true,
      sentAt: true,
      messageIdHeader: true,
      personId: true,
    },
  });

  // A sent message counts as replied if some received email's inReplyTo points back to it.
  const sentMessageIds = sent.map((e) => e.messageIdHeader).filter((id): id is string => !!id);
  const replies = sentMessageIds.length
    ? await db.email.findMany({
        where: { workspaceId, direction: "received", inReplyTo: { in: sentMessageIds } },
        select: { inReplyTo: true },
      })
    : [];
  const repliedMessageIds = new Set(replies.map((r) => r.inReplyTo));

  // Failed sends never produce an Email row, so failures are counted straight off
  // CampaignStepRun instead — mailboxAccountId is recorded on both success and failure
  // (see executeCampaignStepRun/CampaignSendError in campaign-runner.ts) once the mailbox
  // has actually been picked for the attempt.
  const failedRuns = await db.campaignStepRun.findMany({
    where: { workspaceId, status: "failed", mailboxAccountId: { in: mailboxes.map((m) => m.id) } },
    select: { mailboxAccountId: true },
  });

  const personIds = [...new Set(sent.map((e) => e.personId).filter((id): id is string => !!id))];
  const unsubscribedPersons = personIds.length
    ? await db.person.findMany({
        where: { id: { in: personIds }, unsubscribedAt: { not: null } },
        select: { id: true },
      })
    : [];
  const unsubscribedPersonIds = new Set(unsubscribedPersons.map((p) => p.id));

  return mailboxes.map((mailbox) => {
    const own = sent.filter((e) => e.mailboxAccountId === mailbox.id);
    const sentToday = own.filter((e) => e.sentAt >= dayStart).length;
    const sentThisWeek = own.filter((e) => e.sentAt >= weekStart).length;
    const sentThisMonth = own.filter((e) => e.sentAt >= monthStart).length;

    const repliedCount = own.filter((e) => e.messageIdHeader && repliedMessageIds.has(e.messageIdHeader)).length;
    const uniqueRecipients = new Set(own.map((e) => e.personId).filter((id): id is string => !!id));
    const unsubscribedCount = [...uniqueRecipients].filter((id) => unsubscribedPersonIds.has(id)).length;
    const ownFailedCount = failedRuns.filter((r) => r.mailboxAccountId === mailbox.id).length;
    const attempted = own.length + ownFailedCount;

    return {
      mailboxAccountId: mailbox.id,
      label: mailbox.label,
      email: mailbox.email,
      sentToday,
      sentThisWeek,
      sentThisMonth,
      replyRatePct: own.length === 0 ? null : Math.round((repliedCount / own.length) * 100),
      failureRatePct: attempted === 0 ? null : Math.round((ownFailedCount / attempted) * 100),
      unsubscribeRatePct: uniqueRecipients.size === 0 ? null : Math.round((unsubscribedCount / uniqueRecipients.size) * 100),
    };
  });
}
