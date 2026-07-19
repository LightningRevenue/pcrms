import { db } from "@/lib/db";
import { sendViaMailboxAccount } from "@/lib/actions/mailbox-accounts";
import { getTrackingBaseUrlForWorker } from "@/lib/workspace-settings";
import type { CampaignSendJobData } from "@/lib/campaign-queue";

export async function runCampaignSendJob({ campaignMemberId, mailboxAccountId }: CampaignSendJobData) {
  const member = await db.campaignMember.findUniqueOrThrow({
    where: { id: campaignMemberId },
    include: { campaign: { include: { template: true } }, person: true },
  });

  // Recipient was removed, or the campaign's template changed after this job was queued.
  if (member.sendStatus !== "queued") return;
  if (!member.campaign.template) {
    await db.campaignMember.update({
      where: { id: campaignMemberId },
      data: { sendStatus: "failed", sendError: "Campaign has no template selected" },
    });
    return;
  }
  if (!member.person.email) {
    await db.campaignMember.update({
      where: { id: campaignMemberId },
      data: { sendStatus: "failed", sendError: "Contact has no email address" },
    });
    return;
  }

  try {
    const emailId = crypto.randomUUID();
    const trackingBaseUrl = await getTrackingBaseUrlForWorker();
    const trackingPixelHtml = `<img src="${trackingBaseUrl}/api/track/open/${emailId}" width="1" height="1" alt="" style="display:none" />`;

    await sendViaMailboxAccount({
      id: emailId,
      mailboxAccountId,
      personId: member.personId,
      to: [member.person.email],
      subject: member.campaign.template.subject,
      bodyHtml: member.campaign.template.bodyHtml,
      senderId: member.addedById ?? undefined,
      campaignMemberId: member.id,
      trackingPixelHtml,
    });
    await db.campaignMember.update({
      where: { id: campaignMemberId },
      data: { sendStatus: "sent", sentAt: new Date() },
    });
  } catch (err) {
    await db.campaignMember.update({
      where: { id: campaignMemberId },
      data: { sendStatus: "failed", sendError: err instanceof Error ? err.message : String(err) },
    });
    throw err;
  }

  const remaining = await db.campaignMember.count({
    where: { campaignId: member.campaignId, sendStatus: { in: ["pending", "queued"] } },
  });
  if (remaining === 0) {
    await db.campaign.update({ where: { id: member.campaignId }, data: { status: "sent" } });
  }
}
