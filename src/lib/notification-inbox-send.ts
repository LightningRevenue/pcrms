import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { getSetting, SETTING_KEYS } from "@/lib/workspace-settings";
import { sendGmailMessage } from "@/lib/gmail";

// Sends any system-originated email (magic links, reply notifications, ...) from whichever
// inbox is configured in Settings > Email Notifications — either the workspace owner's Gmail
// or one of the connected SMTP mailboxes. Workspace-wide, not per-user.
export async function sendFromNotificationInbox(to: string, subject: string, bodyHtml: string) {
  const selected = await getSetting(SETTING_KEYS.notificationInbox);
  if (!selected) throw new Error("No Email Notifications inbox configured in Settings — set one first.");

  if (selected === "gmail") {
    const owner = await db.user.findFirst({ orderBy: { id: "asc" }, select: { id: true, email: true } });
    if (!owner?.email) throw new Error("No workspace owner with a connected Gmail account.");
    await sendGmailMessage({ userId: owner.id, from: owner.email, to: [to], subject, bodyHtml });
    return;
  }

  const account = await db.mailboxAccount.findUniqueOrThrow({ where: { id: selected } });
  const transport = nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpPort === 465,
    auth: { user: account.username, pass: account.password },
  });
  await transport.sendMail({ from: account.email, to, subject, html: bodyHtml });
}
