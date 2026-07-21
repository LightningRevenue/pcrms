import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { getSetting, SETTING_KEYS } from "@/lib/workspace-settings";
import { sendGmailMessage } from "@/lib/gmail";
import { decrypt } from "@/lib/encryption";

// Sends any system-originated email (magic links, reply notifications, ...) from whichever
// inbox is configured in Settings > Email Notifications — either the workspace owner's Gmail
// or one of the connected SMTP mailboxes. Workspace-wide, not per-user.
export async function sendFromNotificationInbox(to: string, subject: string, bodyHtml: string, workspaceId: string) {
  const selected = await getSetting(SETTING_KEYS.notificationInbox, workspaceId);
  if (!selected) throw new Error("No Email Notifications inbox configured in Settings — set one first.");

  if (selected === "gmail") {
    const ownerMember = await db.workspaceMember.findFirst({
      where: { workspaceId, role: "owner" },
      select: { user: { select: { id: true, email: true } } },
    });
    const owner = ownerMember?.user;
    if (!owner?.email) throw new Error("No workspace owner with a connected Gmail account.");
    await sendGmailMessage({ userId: owner.id, from: owner.email, to: [to], subject, bodyHtml });
    return;
  }

  const account = await db.mailboxAccount.findUniqueOrThrow({ where: { id: selected, workspaceId } });
  const transport = nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpPort === 465,
    auth: { user: account.username, pass: decrypt(account.password) },
  });
  await transport.sendMail({ from: account.email, to, subject, html: bodyHtml });
}
