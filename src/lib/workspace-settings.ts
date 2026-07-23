import { headers } from "next/headers";
import { db } from "@/lib/db";

export const SETTING_KEYS = {
  appBaseUrl: "app_base_url",
  trackingDomain: "tracking_domain",
  // Value is either "gmail" or a MailboxAccount id — the inbox internal CRM notifications
  // (assigned to a teammate, etc.) send from. Workspace-wide, not per-user.
  notificationInbox: "notification_inbox",
  // Custom unsubscribe footer text (HTML), overriding the default "Unsubscribe from future
  // emails." link text — lets a workspace localize it or add extra wording. Set from
  // Settings > GDPR. Falls back to the default in unsubscribe-footer.ts when unset.
  unsubscribeFooterText: "unsubscribe_footer_text",
} as const;

// workspaceId is omitted for the genuinely global keys (app_base_url, tracking_domain);
// pass it for per-workspace keys (notification_inbox). Prisma's compound-unique input
// can't express a NULL workspaceId (its generated type requires `workspaceId: string`,
// even though the column itself is nullable — a Prisma limitation with @@unique over
// optional fields), so the null/global case has to go through findFirst/a manual
// create-or-update instead of workspaceId_key directly.
export async function getSetting(key: string, workspaceId?: string | null) {
  const row = workspaceId
    ? await db.workspaceSetting.findUnique({ where: { workspaceId_key: { workspaceId, key } } })
    : await db.workspaceSetting.findFirst({ where: { workspaceId: null, key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string, workspaceId?: string | null) {
  if (workspaceId) {
    await db.workspaceSetting.upsert({
      where: { workspaceId_key: { workspaceId, key } },
      create: { key, value, workspaceId },
      update: { value },
    });
    return;
  }

  const existing = await db.workspaceSetting.findFirst({ where: { workspaceId: null, key } });
  if (existing) {
    await db.workspaceSetting.update({ where: { id: existing.id }, data: { value } });
  } else {
    await db.workspaceSetting.create({ data: { key, value } });
  }
}

async function resolveConfiguredBaseUrl() {
  const custom = await getSetting(SETTING_KEYS.trackingDomain);
  if (custom) return `https://${custom}`;

  return getSetting(SETTING_KEYS.appBaseUrl);
}

// Request-scoped variant — falls back to the incoming request's host when no
// workspace URL is configured yet. Only callable from a Next.js request context
// (server actions, route handlers); background workers must use
// getTrackingBaseUrlForWorker instead, since next/headers throws outside one.
export async function getTrackingBaseUrl() {
  const configured = await resolveConfiguredBaseUrl();
  if (configured) return configured;

  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

// Worker-safe variant — no next/headers access, so it must fall back to a fixed
// default when no workspace URL is configured (background jobs have no request to read a host from).
export async function getTrackingBaseUrlForWorker() {
  const configured = await resolveConfiguredBaseUrl();
  return configured ?? "http://localhost:3000";
}
