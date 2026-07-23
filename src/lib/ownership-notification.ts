import { sendFromNotificationInbox } from "@/lib/notification-inbox-send";
import { getTrackingBaseUrlForWorker } from "@/lib/workspace-settings";

type EntityKind = "deal" | "contact";

const ENTITY_LABEL: Record<EntityKind, string> = { deal: "deal", contact: "contact" };
const ENTITY_PATH: Record<EntityKind, string> = { deal: "deals", contact: "contacts" };

function buildOwnershipEmailHtml(opts: { entityKind: EntityKind; entityName: string; assignedByName: string; goToUrl: string }) {
  const label = ENTITY_LABEL[opts.entityKind];
  return `
<div style="font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
  <div style="width: 40px; height: 40px; border-radius: 10px; background: #4a63e7; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 16px; margin-bottom: 24px;">C</div>
  <h1 style="font-size: 18px; font-weight: 600; margin: 0 0 8px;">You're now the owner of ${escapeHtml(opts.entityName)}</h1>
  <p style="font-size: 14px; color: #666; margin: 0 0 24px; line-height: 1.5;">${escapeHtml(opts.assignedByName)} assigned this ${label} to you.</p>
  <a href="${opts.goToUrl}" style="display: inline-block; background: #4a63e7; color: white; text-decoration: none; font-size: 13px; font-weight: 500; padding: 10px 18px; border-radius: 8px;">View ${label}</a>
</div>`.trim();
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Notifies the new owner of a deal or contact by email (via the workspace's configured
// notification inbox, same as reply/mention emails) when setOpportunityOwner/setPersonOwner(s)
// assigns them — best-effort, never blocks the ownership change itself.
export async function sendOwnershipEmail(opts: {
  entityKind: EntityKind;
  recipientEmail: string;
  entityId: string;
  entityName: string;
  assignedByName: string;
  workspaceId: string;
}) {
  try {
    const baseUrl = await getTrackingBaseUrlForWorker();
    await sendFromNotificationInbox(
      opts.recipientEmail,
      `You've been assigned: ${opts.entityName}`,
      buildOwnershipEmailHtml({
        entityKind: opts.entityKind,
        entityName: opts.entityName,
        assignedByName: opts.assignedByName,
        goToUrl: `${baseUrl}/${ENTITY_PATH[opts.entityKind]}/${opts.entityId}`,
      }),
      opts.workspaceId
    );
  } catch {
    // ponytail: best-effort — e.g. no notification inbox configured yet in Settings
  }
}
