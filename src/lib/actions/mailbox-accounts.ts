"use server";

import { revalidatePath } from "next/cache";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { auth } from "@/lib/auth";
import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { parseCsv } from "@/lib/csv";
import { interpolateForPerson } from "@/lib/template-variables";
import { encrypt, decrypt } from "@/lib/encryption";
import type { MailboxAccount } from "@prisma/client";
import { assertLimit } from "@/lib/entitlements";

export async function listMailboxAccounts() {
  const { workspaceId } = await requireWorkspace();
  return db.mailboxAccount.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" } });
}

export async function listActiveMailboxAccounts() {
  const { workspaceId } = await requireWorkspace();
  return db.mailboxAccount.findMany({
    where: { workspaceId, active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, label: true, email: true },
  });
}

export type MailboxAccountInput = {
  label: string;
  email: string;
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
  username: string;
  password: string;
};

export async function createMailboxAccount(input: MailboxAccountInput) {
  const { userId, workspaceId } = await requireWorkspace();
  await assertLimit(workspaceId, "outreach_inboxes_feature");
  await assertLimit(workspaceId, "mailbox_accounts_count");

  const label = input.label.trim();
  const email = input.email.trim();
  const smtpHost = input.smtpHost.trim();
  const imapHost = input.imapHost.trim();
  const username = input.username.trim();
  if (!label || !email || !smtpHost || !imapHost || !username || !input.password) {
    throw new Error("All fields are required");
  }

  const account = await db.mailboxAccount.create({
    data: {
      workspaceId,
      label,
      email,
      smtpHost,
      smtpPort: input.smtpPort,
      imapHost,
      imapPort: input.imapPort,
      username,
      password: encrypt(input.password),
      createdById: userId,
    },
  });

  revalidatePath("/settings/accounts/outreach-inboxes");
  return account;
}

export async function toggleMailboxAccount(id: string, active: boolean) {
  const { workspaceId } = await requireWorkspace();

  await db.mailboxAccount.update({ where: { id, workspaceId }, data: { active } });
  revalidatePath("/settings/accounts/outreach-inboxes");
}

export async function deleteMailboxAccount(id: string) {
  const { workspaceId } = await requireWorkspace();

  await db.mailboxAccount.delete({ where: { id, workspaceId } });
  revalidatePath("/settings/accounts/outreach-inboxes");
}

// Expects the maildoso-style export header: Email, First Name, Last Name, IMAP Username,
// IMAP Password, IMAP Host, IMAP Port, SMTP Username, SMTP Password, SMTP Host, SMTP Port
// (Daily Limit / Warmup columns are ignored — no sending rules yet).
export async function importMailboxAccountsCsv(csvText: string) {
  const { userId, workspaceId } = await requireWorkspace();

  const rows = parseCsv(csvText);
  const [header, ...dataRows] = rows;
  if (!header) throw new Error("CSV appears to be empty");

  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const idx = {
    email: col("email"),
    firstName: col("first name"),
    lastName: col("last name"),
    imapUser: col("imap username"),
    imapPass: col("imap password"),
    imapHost: col("imap host"),
    imapPort: col("imap port"),
    smtpUser: col("smtp username"),
    smtpPass: col("smtp password"),
    smtpHost: col("smtp host"),
    smtpPort: col("smtp port"),
  };
  if (idx.email === -1 || idx.smtpHost === -1 || idx.imapHost === -1) {
    throw new Error("CSV is missing required columns (Email, SMTP Host, IMAP Host)");
  }

  const existing = new Set((await db.mailboxAccount.findMany({ where: { workspaceId }, select: { email: true } })).map((a) => a.email));

  let imported = 0;
  let skipped = 0;

  for (const row of dataRows) {
    const email = row[idx.email]?.trim();
    if (!email || existing.has(email)) {
      skipped++;
      continue;
    }

    const firstName = idx.firstName !== -1 ? row[idx.firstName]?.trim() : "";
    const lastName = idx.lastName !== -1 ? row[idx.lastName]?.trim() : "";
    const label = [firstName, lastName].filter(Boolean).join(" ") || email;

    await assertLimit(workspaceId, "mailbox_accounts_count");
    await db.mailboxAccount.create({
      data: {
        workspaceId,
        label,
        email,
        smtpHost: row[idx.smtpHost]?.trim() ?? "",
        smtpPort: Number(row[idx.smtpPort]) || 587,
        imapHost: row[idx.imapHost]?.trim() ?? "",
        imapPort: Number(row[idx.imapPort]) || 993,
        username: (idx.smtpUser !== -1 ? row[idx.smtpUser]?.trim() : "") || email,
        password: encrypt((idx.smtpPass !== -1 ? row[idx.smtpPass] : row[idx.imapPass]) ?? ""),
        createdById: userId,
      },
    });
    existing.add(email);
    imported++;
  }

  revalidatePath("/settings/accounts/outreach-inboxes");
  return { imported, skipped };
}

async function checkSmtp(account: MailboxAccount): Promise<{ status: "ok" | "error"; error: string | null }> {
  try {
    const transport = nodemailer.createTransport({
      host: account.smtpHost,
      port: account.smtpPort,
      secure: account.smtpPort === 465,
      auth: { user: account.username, pass: decrypt(account.password) },
      connectionTimeout: 10_000,
    });
    await transport.verify();
    transport.close();
    return { status: "ok", error: null };
  } catch (err) {
    return { status: "error", error: err instanceof Error ? err.message : String(err) };
  }
}

async function checkImap(account: MailboxAccount): Promise<{ status: "ok" | "error"; error: string | null }> {
  const client = new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: account.imapPort === 993,
    auth: { user: account.username, pass: decrypt(account.password) },
    logger: false,
    connectionTimeout: 10_000,
  });
  try {
    await client.connect();
    return { status: "ok", error: null };
  } catch (err) {
    return { status: "error", error: err instanceof Error ? err.message : String(err) };
  } finally {
    client.close();
  }
}

export async function checkMailboxAccount(id: string) {
  const { workspaceId } = await requireWorkspace();

  const account = await db.mailboxAccount.findUniqueOrThrow({ where: { id, workspaceId } });
  const [smtp, imap] = await Promise.all([checkSmtp(account), checkImap(account)]);

  const updated = await db.mailboxAccount.update({
    where: { id, workspaceId },
    data: {
      smtpStatus: smtp.status,
      smtpError: smtp.error,
      imapStatus: imap.status,
      imapError: imap.error,
      lastCheckedAt: new Date(),
    },
  });

  revalidatePath("/settings/accounts/outreach-inboxes");
  return updated;
}

export async function checkAllMailboxAccounts() {
  const { workspaceId } = await requireWorkspace();

  const accounts = await db.mailboxAccount.findMany({ where: { workspaceId }, select: { id: true } });
  const results = await Promise.all(accounts.map(({ id }) => checkMailboxAccount(id)));
  revalidatePath("/settings/accounts/outreach-inboxes");
  return results;
}

export type SendViaMailboxAccountInput = {
  mailboxAccountId: string;
  personId: string;
  to: string[];
  subject: string;
  bodyHtml: string;
  senderId?: string;
  bcc?: string[];
  replyToEmailId?: string;
  opportunityIds?: string[];
  campaignMemberId?: string;
  // Injects an open-tracking pixel pointed at /api/track/open/<id> — the caller must
  // pre-generate the Email id (crypto.randomUUID()) so the pixel URL matches the row
  // created below. Same approach as sequence-runner.ts's Gmail sends.
  trackingPixelHtml?: string;
  id?: string;
  // Background-worker callers (campaign-runner, sequence-runner) already know the
  // workspaceId of the record they're operating on and pass it explicitly — this
  // function has no request session to derive one from itself.
  workspaceId: string;
};

// Core SMTP send, with no auth() dependency — safe to call from a background worker
// (e.g. campaign-runner.ts) as well as from the authenticated sendViaSmtp action below.
export async function sendViaMailboxAccount(input: SendViaMailboxAccountInput) {
  if (input.to.length === 0) throw new Error("Add at least one recipient");
  if (!input.subject.trim()) throw new Error("Add a subject");
  await assertLimit(input.workspaceId, "emails_sent_monthly");

  const account = await db.mailboxAccount.findUniqueOrThrow({ where: { id: input.mailboxAccountId, workspaceId: input.workspaceId } });

  const replyTo = input.replyToEmailId
    ? await db.email.findUnique({ where: { id: input.replyToEmailId, workspaceId: input.workspaceId } })
    : null;

  const [subject, interpolatedBody] = await Promise.all([
    interpolateForPerson(input.subject, input.personId, input.workspaceId),
    interpolateForPerson(input.bodyHtml, input.personId, input.workspaceId),
  ]);
  const bodyHtml = interpolatedBody + (input.trackingPixelHtml ?? "");

  const bcc = input.bcc ?? [];

  const transport = nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpPort === 465,
    auth: { user: account.username, pass: decrypt(account.password) },
  });

  const sent = await transport.sendMail({
    from: account.email,
    to: input.to,
    bcc: bcc.length ? bcc : undefined,
    subject,
    html: bodyHtml,
    inReplyTo: replyTo?.messageIdHeader ?? undefined,
    references: replyTo?.messageIdHeader ?? undefined,
  });

  const email = await db.email.create({
    data: {
      id: input.id,
      workspaceId: input.workspaceId,
      messageIdHeader: sent.messageId,
      inReplyTo: replyTo?.messageIdHeader ?? undefined,
      direction: "sent",
      from: account.email,
      to: input.to,
      cc: [],
      bcc,
      subject,
      bodyHtml,
      personId: input.personId,
      senderId: input.senderId,
      mailboxAccountId: account.id,
      campaignMemberId: input.campaignMemberId,
      opportunities: input.opportunityIds?.length
        ? { createMany: { data: input.opportunityIds.map((opportunityId) => ({ workspaceId: input.workspaceId, opportunityId })) } }
        : undefined,
    },
  });

  await db.activity.create({
    data: {
      workspaceId: input.workspaceId,
      entityType: "person",
      entityId: input.personId,
      kind: "email_sent",
      field: "Email",
      newValue: subject,
      actorId: input.senderId,
    },
  });

  return email;
}

export type SendViaSmtpInput = {
  mailboxAccountId: string;
  personId: string;
  to: string[];
  subject: string;
  bodyHtml: string;
  replyToEmailId?: string;
  opportunityIds?: string[];
};

export async function sendViaSmtp(input: SendViaSmtpInput) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) throw new Error("Not authenticated");
  if (!session.user.workspaceId) throw new Error("No workspace");

  // CC the user's own connected Gmail on outreach-mailbox sends so they keep visibility
  // in their normal inbox — replies still land only at the outreach mailbox, never Gmail.
  const email = await sendViaMailboxAccount({
    ...input,
    workspaceId: session.user.workspaceId,
    senderId: session.user.id,
    bcc: [session.user.email],
  });

  revalidatePath("/inbox");
  revalidatePath(`/contacts/${input.personId}`);
  if (input.opportunityIds?.length) {
    for (const opportunityId of input.opportunityIds) revalidatePath(`/deals/${opportunityId}`);
  }
  return email;
}
