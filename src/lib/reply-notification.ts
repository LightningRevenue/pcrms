import { db } from "@/lib/db";
import { sendFromNotificationInbox } from "@/lib/notification-inbox-send";
import { getTrackingBaseUrlForWorker } from "@/lib/workspace-settings";

function buildReplyEmailHtml(opts: { senderName: string; subject: string; goToUrl: string; goToLabel: string }) {
  return `
<div style="font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
  <div style="width: 40px; height: 40px; border-radius: 10px; background: #4a63e7; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 16px; margin-bottom: 24px;">C</div>
  <h1 style="font-size: 18px; font-weight: 600; margin: 0 0 8px;">New reply from ${escapeHtml(opts.senderName)}</h1>
  <p style="font-size: 14px; color: #666; margin: 0 0 24px; line-height: 1.5;">${escapeHtml(opts.subject)}</p>
  <a href="${opts.goToUrl}" style="display: inline-block; background: #4a63e7; color: white; text-decoration: none; font-size: 13px; font-weight: 500; padding: 10px 18px; border-radius: 8px;">${opts.goToLabel}</a>
  <p style="font-size: 12px; color: #999; margin-top: 32px;">You're receiving this because you're the owner of this contact in the CRM.</p>
</div>`.trim();
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Notifies the owning teammate by email when a reply arrives on a contact (or, absent an
// owner, the workspace owner) — separate from the in-app Notification row, which still fires
// for whoever's logged in. Best-effort: a failure here should never break the mail sync itself.
export async function sendReplyEmailNotification(opts: { personId: string | null; subject: string; workspaceId: string }) {
  try {
    const person = opts.personId
      ? await db.person.findUnique({ where: { id: opts.personId, workspaceId: opts.workspaceId }, include: { owner: true } })
      : null;

    const workspaceOwnerMember = person?.owner
      ? null
      : await db.workspaceMember.findFirst({
          where: { workspaceId: opts.workspaceId, role: "owner" },
          select: { user: { select: { id: true, name: true, email: true } } },
        });
    const recipient = person?.owner ?? workspaceOwnerMember?.user;
    if (!recipient?.email) return;

    const senderName = person ? [person.firstName, person.lastName].filter(Boolean).join(" ") : "someone new";
    const baseUrl = await getTrackingBaseUrlForWorker();
    const goToUrl = person ? `${baseUrl}/contacts/${person.id}?tab=emails` : `${baseUrl}/inbox`;
    const goToLabel = person ? "Go to contact" : "Go to Unified Inbox";

    await sendFromNotificationInbox(
      recipient.email,
      `New reply from ${senderName}`,
      buildReplyEmailHtml({ senderName, subject: opts.subject, goToUrl, goToLabel }),
      opts.workspaceId
    );
  } catch {
    // ponytail: best-effort — the in-app Notification row is still the source of truth if this fails
  }
}
