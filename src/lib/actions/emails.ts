"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { sendGmailMessage } from "@/lib/gmail";
import { syncPersonEmailThreads } from "@/lib/gmail-sync";
import { getTrackingBaseUrl } from "@/lib/workspace-settings";
import { interpolateForPerson } from "@/lib/template-variables";

export type SendEmailInput = {
  personId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  replyToEmailId?: string;
  opportunityIds?: string[];
};

export async function sendEmail(input: SendEmailInput) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) throw new Error("Not authenticated");
  const workspaceId = session.user.workspaceId;
  if (!workspaceId) throw new Error("No workspace");

  const replyTo = input.replyToEmailId
    ? await db.email.findUnique({ where: { id: input.replyToEmailId, workspaceId } })
    : null;

  const threadEmails = replyTo?.gmailThreadId
    ? await db.email.findMany({
        where: { workspaceId, gmailThreadId: replyTo.gmailThreadId },
        orderBy: { sentAt: "asc" },
        select: { messageIdHeader: true },
      })
    : [];
  const references = threadEmails
    .map((e) => e.messageIdHeader)
    .filter((id): id is string => !!id);

  const [subject, bodyHtml] = await Promise.all([
    interpolateForPerson(input.subject, input.personId, workspaceId),
    interpolateForPerson(input.bodyHtml, input.personId, workspaceId),
  ]);

  const emailId = crypto.randomUUID();
  const trackingBaseUrl = await getTrackingBaseUrl();
  const trackingPixel = `<img src="${trackingBaseUrl}/api/track/open/${emailId}" width="1" height="1" alt="" style="display:none" />`;

  const sent = await sendGmailMessage({
    userId: session.user.id,
    from: session.user.email,
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    subject,
    bodyHtml: bodyHtml + trackingPixel,
    threadId: replyTo?.gmailThreadId ?? undefined,
    inReplyTo: replyTo?.messageIdHeader ?? undefined,
    references,
  });

  const email = await db.email.create({
    data: {
      id: emailId,
      workspaceId,
      gmailMessageId: sent.id,
      gmailThreadId: sent.threadId,
      messageIdHeader: sent.messageIdHeader ?? undefined,
      direction: "sent",
      from: session.user.email,
      to: input.to,
      cc: input.cc ?? [],
      bcc: input.bcc ?? [],
      subject,
      bodyHtml,
      personId: input.personId,
      senderId: session.user.id,
      opportunities: input.opportunityIds?.length
        ? { createMany: { data: input.opportunityIds.map((opportunityId) => ({ workspaceId, opportunityId })) } }
        : undefined,
    },
  });

  await db.activity.create({
    data: {
      workspaceId,
      entityType: "person",
      entityId: input.personId,
      kind: "email_sent",
      field: "Email",
      newValue: subject,
      actorId: session.user.id,
    },
  });

  revalidatePath(`/contacts/${input.personId}`);
  return email;
}

export async function listTemplates() {
  const { workspaceId } = await requireWorkspace();
  return db.emailTemplate.findMany({ where: { workspaceId }, orderBy: { name: "asc" } });
}

export type TemplateInput = { name: string; subject: string; bodyHtml: string };

export async function createTemplate(input: TemplateInput) {
  const { userId, workspaceId } = await requireWorkspace();

  const name = input.name.trim();
  if (!name) throw new Error("Name is required");

  const template = await db.emailTemplate.create({
    data: { workspaceId, name, subject: input.subject.trim(), bodyHtml: input.bodyHtml, createdById: userId },
  });

  revalidatePath("/settings/email-templates");
  return template;
}

export async function updateTemplate(id: string, input: TemplateInput) {
  const { workspaceId } = await requireWorkspace();

  const name = input.name.trim();
  if (!name) throw new Error("Name is required");

  const template = await db.emailTemplate.update({
    where: { id, workspaceId },
    data: { name, subject: input.subject.trim(), bodyHtml: input.bodyHtml },
  });

  revalidatePath("/settings/email-templates");
  return template;
}

export async function deleteTemplate(id: string) {
  const { workspaceId } = await requireWorkspace();

  await db.emailTemplate.delete({ where: { id, workspaceId } });
  revalidatePath("/settings/email-templates");
}

export async function syncContactEmails(personId: string) {
  const { userId, workspaceId } = await requireWorkspace();

  const newCount = await syncPersonEmailThreads(userId, personId, workspaceId);
  revalidatePath(`/contacts/${personId}`);
  return newCount;
}
