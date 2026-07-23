import { buildUnsubscribeToken } from "@/lib/gdpr";
import { getTrackingBaseUrlForWorker } from "@/lib/workspace-settings";

// Shared by every send path (manual compose, campaigns, sequences) so the unsubscribe link
// and header are identical everywhere, not reimplemented per call site.
export async function buildUnsubscribeUrl(personId: string): Promise<string> {
  const baseUrl = await getTrackingBaseUrlForWorker();
  const token = buildUnsubscribeToken(personId);
  return `${baseUrl}/api/unsubscribe/${token}`;
}

// RFC 8058 headers: List-Unsubscribe alone gets Gmail/Outlook/etc. to show their own native
// "Unsubscribe" link next to the sender name; List-Unsubscribe-Post opts into one-click (no
// confirmation page, no user visiting the app) — mail clients only show the native button
// when both headers are present and List-Unsubscribe uses the mailto:/https: bracket syntax.
export function unsubscribeHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

// Appended to bodyHtml right before send — the visible fallback for clients that don't
// surface the List-Unsubscribe header as a native button.
export function appendUnsubscribeFooter(bodyHtml: string, unsubscribeUrl: string): string {
  return `${bodyHtml}<p style="font-size:11px;color:#999;margin-top:24px;"><a href="${unsubscribeUrl}" style="color:#999;">Unsubscribe</a> from future emails.</p>`;
}
