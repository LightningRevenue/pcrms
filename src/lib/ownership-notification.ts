import { sendFromNotificationInbox } from "@/lib/notification-inbox-send";
import { getTrackingBaseUrlForWorker } from "@/lib/workspace-settings";

function buildOwnershipEmailHtml(opts: { dealName: string; assignedByName: string; goToUrl: string }) {
  return `
<div style="font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
  <div style="width: 40px; height: 40px; border-radius: 10px; background: #4a63e7; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 16px; margin-bottom: 24px;">C</div>
  <h1 style="font-size: 18px; font-weight: 600; margin: 0 0 8px;">You're now the owner of ${escapeHtml(opts.dealName)}</h1>
  <p style="font-size: 14px; color: #666; margin: 0 0 24px; line-height: 1.5;">${escapeHtml(opts.assignedByName)} assigned this deal to you.</p>
  <a href="${opts.goToUrl}" style="display: inline-block; background: #4a63e7; color: white; text-decoration: none; font-size: 13px; font-weight: 500; padding: 10px 18px; border-radius: 8px;">View deal</a>
</div>`.trim();
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Notifies a deal's new owner by email (via the workspace's configured notification inbox,
// same as reply/mention emails) when moveOpportunityStage or setOpportunityOwner assigns them
// — best-effort, never blocks the ownership change itself.
export async function sendOwnershipEmail(opts: {
  recipientEmail: string;
  dealId: string;
  dealName: string;
  assignedByName: string;
  workspaceId: string;
}) {
  try {
    const baseUrl = await getTrackingBaseUrlForWorker();
    await sendFromNotificationInbox(
      opts.recipientEmail,
      `You've been assigned: ${opts.dealName}`,
      buildOwnershipEmailHtml({
        dealName: opts.dealName,
        assignedByName: opts.assignedByName,
        goToUrl: `${baseUrl}/deals/${opts.dealId}`,
      }),
      opts.workspaceId
    );
  } catch {
    // ponytail: best-effort — e.g. no notification inbox configured yet in Settings
  }
}
