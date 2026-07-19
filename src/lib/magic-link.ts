import { db } from "@/lib/db";
import { sendFromNotificationInbox } from "@/lib/notification-inbox-send";

function buildEmailHtml(url: string) {
  return `<p>Click below to sign in to the CRM:</p><p><a href="${url}">${url}</a></p><p>This link expires in 24 hours.</p>`;
}

export async function sendMagicLink(identifier: string, url: string) {
  // Only emails already added as a User (via Settings > Members) can sign in this way — this
  // is the actual enforcement point, since the Prisma adapter would otherwise auto-create a
  // User for any email that requests a link. No email sent means no link, means no session.
  const existing = await db.user.findUnique({ where: { email: identifier } });
  if (!existing) throw new Error("This email hasn't been added as a member yet. Ask a workspace admin to add it in Settings > Members.");

  await sendFromNotificationInbox(identifier, "Sign in to CRM", buildEmailHtml(url));
}
