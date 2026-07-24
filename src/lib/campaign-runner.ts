import { db } from "@/lib/db";
import { sendViaMailboxAccount } from "@/lib/actions/mailbox-accounts";
import { getTrackingBaseUrlForWorker } from "@/lib/workspace-settings";

const CRON_JOB_NAME = "campaign-step-runner";

// Random pace between step-1 sends within one enrollment batch, so a bulk startCampaign
// doesn't look/behave like a mail blast. Reactive single-member enrollments (batch size 1)
// don't need this — they just get scheduledFor = now.
const MIN_SEND_GAP_MS = 30_000;
const MAX_SEND_GAP_MS = 60_000;

// "sent" is a live snapshot ("nothing outstanding right now"), not a lock — this can flip
// a drained campaign back to "active" the moment a new member is reactively enrolled.
async function syncCampaignStatus(campaignId: string, workspaceId: string) {
  const outstanding = await db.campaignStepRun.count({
    where: { workspaceId, member: { campaignId }, status: "pending" },
  });
  await db.campaign.update({
    where: { id: campaignId, workspaceId },
    data: { status: outstanding > 0 ? "active" : "sent" },
  });
}

// Assigns a random variant and schedules one CampaignStepRun per campaign step, cumulative
// delay from *now*. Called from startCampaign's batch loop (first start) and from each
// addXToCampaign action for a single late-added member once the campaign isn't "draft"
// (reactive enrollment) — idempotent via the enrolledAt guard, safe to call twice.
export async function enrollCampaignMember(memberId: string, workspaceId: string, staggerMs = 0) {
  const member = await db.campaignMember.findUniqueOrThrow({
    where: { id: memberId, workspaceId },
    include: { campaign: { include: { steps: true, variants: true } } },
  });
  if (member.enrolledAt) return;
  if (member.campaign.variants.length === 0 || member.campaign.steps.length === 0) return;

  const variant = member.campaign.variants[Math.floor(Math.random() * member.campaign.variants.length)];
  const now = new Date();

  await db.campaignMember.update({
    where: { id: memberId, workspaceId },
    data: { variantId: variant.id, enrolledAt: now },
  });

  await db.campaignStepRun.createMany({
    data: member.campaign.steps.map((step) => ({
      workspaceId,
      memberId,
      stepId: step.id,
      scheduledFor: new Date(now.getTime() + staggerMs + (step.delayDays * 24 + step.delayHours) * 3600 * 1000),
    })),
  });

  await syncCampaignStatus(member.campaignId, workspaceId);
}

// Enrolls every not-yet-enrolled member of a campaign, staggering step-1 sends 30-60s
// apart within the batch (see enrollCampaignMember) so a bulk start trickles out over time.
export async function enrollCampaignMembers(memberIds: string[], workspaceId: string) {
  let cumulativeDelay = 0;
  for (let i = 0; i < memberIds.length; i++) {
    if (i > 0) cumulativeDelay += MIN_SEND_GAP_MS + Math.random() * (MAX_SEND_GAP_MS - MIN_SEND_GAP_MS);
    await enrollCampaignMember(memberIds[i], workspaceId, Math.round(cumulativeDelay));
  }
}

// Round robin over the campaign's *currently* selected mailboxes, computed at execution
// time rather than snapshotted per-batch, so a late-added member's send uses whichever
// mailboxes are selected now, not a stale list from the original startCampaign call.
// ponytail: global send-count mod mailbox-count, not a per-mailbox fairness queue — upgrade
// to a per-CampaignMailbox counter/lastUsedAt if exact even distribution under concurrent
// workers ever matters. Same best-effort tolerance the old i % mailboxes.length already had.
async function pickMailboxAccountId(campaignId: string, workspaceId: string): Promise<string> {
  const mailboxes = await db.campaignMailbox.findMany({
    where: { workspaceId, campaignId },
    orderBy: { addedAt: "asc" },
  });
  if (mailboxes.length === 0) throw new Error("Campaign has no outreach inboxes selected");

  const sentSoFar = await db.campaignStepRun.count({
    where: { workspaceId, status: { not: "pending" }, member: { campaignId } },
  });
  return mailboxes[sentSoFar % mailboxes.length].mailboxAccountId;
}

// Thrown once the mailbox has been picked, so a failure downstream (e.g. sendViaMailboxAccount
// throwing) still tells the caller which inbox the attempt was made from — matters for the
// per-inbox failure-rate stat in inbox-placement-stats.ts, which otherwise can't attribute a
// failed run to any mailbox at all.
class CampaignSendError extends Error {
  constructor(message: string, public mailboxAccountId: string) {
    super(message);
  }
}

async function executeCampaignStepRun(run: {
  id: string;
  workspaceId: string;
  stepId: string;
  memberId: string;
}) {
  const member = await db.campaignMember.findUniqueOrThrow({
    where: { id: run.memberId, workspaceId: run.workspaceId },
    include: { person: true },
  });
  if (!member.variantId) throw new Error("Member has no assigned variant");
  if (!member.person.email) throw new Error("Contact has no email address");

  const body = await db.campaignStepBody.findUnique({
    where: { stepId_variantId: { stepId: run.stepId, variantId: member.variantId } },
    include: { template: true },
  });
  if (!body) throw new Error("No content configured for this step/variant");

  const subject = body.templateId ? body.template!.subject : body.subject ?? "";
  const bodyHtml = body.templateId ? body.template!.bodyHtml : body.bodyHtml ?? "";

  const mailboxAccountId = await pickMailboxAccountId(member.campaignId, run.workspaceId);

  const emailId = crypto.randomUUID();
  const trackingBaseUrl = await getTrackingBaseUrlForWorker();
  const trackingPixelHtml = `<img src="${trackingBaseUrl}/api/track/open/${emailId}" width="1" height="1" alt="" style="display:none" />`;

  try {
    // sendViaMailboxAccount interpolates merge fields and enforces unsubscribe internally —
    // pass the raw subject/bodyHtml, same as the pre-multi-step campaign sender did.
    await sendViaMailboxAccount({
      id: emailId,
      workspaceId: run.workspaceId,
      mailboxAccountId,
      personId: member.personId,
      to: [member.person.email],
      subject,
      bodyHtml,
      senderId: member.addedById ?? undefined,
      campaignMemberId: member.id,
      trackingPixelHtml,
    });
  } catch (err) {
    throw new CampaignSendError(err instanceof Error ? err.message : String(err), mailboxAccountId);
  }

  await db.campaignStepRun.update({
    where: { id: run.id, workspaceId: run.workspaceId },
    data: { status: "sent", executedAt: new Date(), mailboxAccountId },
  });
}

export async function runDueCampaignSteps() {
  const run = await db.cronJobRun.create({ data: { job: CRON_JOB_NAME, status: "running" } });

  let stepsExecuted = 0;
  try {
    // Not scoped by workspaceId — runs globally across every workspace's due campaign
    // steps, same pattern as runDueSequenceSteps. Each row carries its own workspaceId.
    const due = await db.campaignStepRun.findMany({
      where: { status: "pending", scheduledFor: { lte: new Date() } },
    });

    for (const dueRun of due) {
      try {
        await executeCampaignStepRun(dueRun);
        stepsExecuted += 1;
      } catch (err) {
        await db.campaignStepRun.update({
          where: { id: dueRun.id, workspaceId: dueRun.workspaceId },
          data: {
            status: "failed",
            executedAt: new Date(),
            error: err instanceof Error ? err.message : String(err),
            mailboxAccountId: err instanceof CampaignSendError ? err.mailboxAccountId : undefined,
          },
        });
      }

      const member = await db.campaignMember.findUniqueOrThrow({
        where: { id: dueRun.memberId, workspaceId: dueRun.workspaceId },
        select: { campaignId: true },
      });
      await syncCampaignStatus(member.campaignId, dueRun.workspaceId);
    }

    await db.cronJobRun.update({
      where: { id: run.id },
      data: { status: "success", finishedAt: new Date(), emailsFound: stepsExecuted },
    });
  } catch (err) {
    await db.cronJobRun.update({
      where: { id: run.id },
      data: {
        status: "error",
        finishedAt: new Date(),
        emailsFound: stepsExecuted,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}

// Called from imap-sync.ts whenever a "received" Email lands for a person recognized as a
// CRM contact — mirrors cancelActiveEmailStepsOnReply's behavior for Sequence: a reply
// means the person is already engaged, so remaining pending campaign steps for them stop
// rather than talk past them.
export async function cancelPendingCampaignStepsOnReply(personId: string, workspaceId: string) {
  const members = await db.campaignMember.findMany({
    where: { workspaceId, personId },
    select: { id: true, campaignId: true },
  });
  if (members.length === 0) return;

  await db.campaignStepRun.updateMany({
    where: { workspaceId, memberId: { in: members.map((m) => m.id) }, status: "pending" },
    data: { status: "skipped" },
  });

  const campaignIds = [...new Set(members.map((m) => m.campaignId))];
  for (const campaignId of campaignIds) {
    await syncCampaignStatus(campaignId, workspaceId);
  }
}
