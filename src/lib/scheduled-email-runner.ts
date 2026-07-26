import { db } from "@/lib/db";
import { sendViaMailboxAccount } from "@/lib/actions/mailbox-accounts";
import { sendGmailMessage } from "@/lib/gmail";
import { getTrackingBaseUrlForWorker } from "@/lib/workspace-settings";
import { interpolateForPerson } from "@/lib/template-variables";
import { assertLimit } from "@/lib/entitlements";
import { assertNotUnsubscribed } from "@/lib/gdpr";
import { buildUnsubscribeUrl, unsubscribeHeaders, appendUnsubscribeFooter } from "@/lib/unsubscribe-footer";

const CRON_JOB_NAME = "scheduled-email-runner";

// Delivers "Send later" emails once they come due. Runs inside campaign-worker's existing 60s
// tick (see worker/campaign-worker.ts) rather than in a worker of its own — the cadence and
// the Redis/lock setup are identical, so a second process would buy nothing.
//
// Both composer transports are supported: Gmail as the scheduling user when mailboxAccountId
// is null, that mailbox's SMTP otherwise. The transport choice is frozen on the row because
// the worker has no session to re-derive it from.

async function sendOneScheduledEmail(id: string) {
  const scheduled = await db.scheduledEmail.findUniqueOrThrow({
    where: { id },
    include: { person: true, sender: true },
  });
  if (scheduled.status !== "pending") return;

  const { workspaceId, personId, senderId } = scheduled;

  // Re-checked at send time, not just at schedule time: a contact can unsubscribe, or the plan
  // quota run out, in the gap between scheduling and delivery.
  await assertLimit(workspaceId, "emails_sent_monthly");
  await assertNotUnsubscribed(personId);

  if (scheduled.mailboxAccountId) {
    // SMTP path — sendViaMailboxAccount already interpolates, appends the unsubscribe footer,
    // enforces unsubscribe, and writes the Email + Activity rows.
    const emailId = crypto.randomUUID();
    const trackingBaseUrl = await getTrackingBaseUrlForWorker();
    const email = await sendViaMailboxAccount({
      id: emailId,
      workspaceId,
      mailboxAccountId: scheduled.mailboxAccountId,
      personId,
      senderId,
      to: scheduled.to,
      bcc: scheduled.bcc,
      subject: scheduled.subject,
      bodyHtml: scheduled.bodyHtml,
      replyToEmailId: scheduled.replyToEmailId ?? undefined,
      opportunityIds: scheduled.opportunityIds,
      trackingPixelHtml: `<img src="${trackingBaseUrl}/api/track/open/${emailId}" width="1" height="1" alt="" style="display:none" />`,
    });
    return email.id;
  }

  // Gmail path — mirrors sequence-runner.ts, which sends as a stored user rather than a session.
  if (!scheduled.sender.email) throw new Error("The scheduling user has no connected email");

  const replyTo = scheduled.replyToEmailId
    ? await db.email.findUnique({ where: { id: scheduled.replyToEmailId, workspaceId } })
    : null;

  const [subject, interpolatedBody, unsubscribeUrl] = await Promise.all([
    interpolateForPerson(scheduled.subject, personId, workspaceId),
    interpolateForPerson(scheduled.bodyHtml, personId, workspaceId),
    buildUnsubscribeUrl(personId),
  ]);
  const bodyHtml = await appendUnsubscribeFooter(interpolatedBody, unsubscribeUrl, workspaceId);

  const emailId = crypto.randomUUID();
  const trackingBaseUrl = await getTrackingBaseUrlForWorker();
  const trackingPixel = `<img src="${trackingBaseUrl}/api/track/open/${emailId}" width="1" height="1" alt="" style="display:none" />`;

  const sent = await sendGmailMessage({
    userId: senderId,
    from: scheduled.sender.email,
    to: scheduled.to,
    cc: scheduled.cc.length ? scheduled.cc : undefined,
    bcc: scheduled.bcc.length ? scheduled.bcc : undefined,
    subject,
    bodyHtml: bodyHtml + trackingPixel,
    // Keeps a scheduled reply in the same Gmail thread it was composed from.
    threadId: replyTo?.gmailThreadId ?? undefined,
    inReplyTo: replyTo?.messageIdHeader ?? undefined,
    extraHeaders: unsubscribeHeaders(unsubscribeUrl),
  });

  await db.email.create({
    data: {
      id: emailId,
      workspaceId,
      gmailMessageId: sent.id,
      gmailThreadId: sent.threadId,
      messageIdHeader: sent.messageIdHeader ?? undefined,
      inReplyTo: replyTo?.messageIdHeader ?? undefined,
      direction: "sent",
      from: scheduled.sender.email,
      to: scheduled.to,
      cc: scheduled.cc,
      bcc: scheduled.bcc,
      subject,
      bodyHtml,
      personId,
      senderId,
      opportunities: scheduled.opportunityIds.length
        ? { createMany: { data: scheduled.opportunityIds.map((opportunityId) => ({ workspaceId, opportunityId })) } }
        : undefined,
    },
  });

  await db.activity.create({
    data: {
      workspaceId,
      entityType: "person",
      entityId: personId,
      kind: "email_sent",
      field: "Email",
      newValue: subject,
      actorId: senderId,
    },
  });

  return emailId;
}

export async function runDueScheduledEmails() {
  const run = await db.cronJobRun.create({ data: { job: CRON_JOB_NAME, status: "running" } });

  let sent = 0;
  try {
    // Not scoped by workspaceId — runs globally, same as runDueCampaignSteps. Each row carries
    // its own workspaceId.
    const due = await db.scheduledEmail.findMany({
      where: { status: "pending", scheduledFor: { lte: new Date() } },
      select: { id: true },
      orderBy: { scheduledFor: "asc" },
    });

    for (const { id } of due) {
      try {
        const sentEmailId = await sendOneScheduledEmail(id);
        await db.scheduledEmail.update({
          where: { id },
          data: { status: "sent", sentAt: new Date(), sentEmailId, error: null },
        });
        sent++;
      } catch (err) {
        // One bad row (unsubscribed contact, revoked Gmail token, dead SMTP host) must not
        // stall everyone else's scheduled mail.
        await db.scheduledEmail.update({
          where: { id },
          data: { status: "failed", error: err instanceof Error ? err.message : String(err) },
        });
      }
    }

    await db.cronJobRun.update({
      where: { id: run.id },
      data: { status: "success", finishedAt: new Date(), emailsFound: sent },
    });
  } catch (err) {
    await db.cronJobRun.update({
      where: { id: run.id },
      data: {
        status: "error",
        finishedAt: new Date(),
        emailsFound: sent,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}
