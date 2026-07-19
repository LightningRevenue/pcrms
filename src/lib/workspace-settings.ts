import { headers } from "next/headers";
import { db } from "@/lib/db";

export const SETTING_KEYS = {
  appBaseUrl: "app_base_url",
  trackingDomain: "tracking_domain",
  allowedEmailDomain: "allowed_email_domain",
  // Value is either "gmail" or a MailboxAccount id — the inbox internal CRM notifications
  // (assigned to a teammate, etc.) send from. Workspace-wide, not per-user.
  notificationInbox: "notification_inbox",
} as const;

export async function getSetting(key: string) {
  const row = await db.workspaceSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await db.workspaceSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
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
