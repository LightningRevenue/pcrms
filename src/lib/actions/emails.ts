"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
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

  const replyTo = input.replyToEmailId
    ? await db.email.findUnique({ where: { id: input.replyToEmailId } })
    : null;

  const threadEmails = replyTo?.gmailThreadId
    ? await db.email.findMany({
        where: { gmailThreadId: replyTo.gmailThreadId },
        orderBy: { sentAt: "asc" },
        select: { messageIdHeader: true },
      })
    : [];
  const references = threadEmails
    .map((e) => e.messageIdHeader)
    .filter((id): id is string => !!id);

  const [subject, bodyHtml] = await Promise.all([
    interpolateForPerson(input.subject, input.personId),
    interpolateForPerson(input.bodyHtml, input.personId),
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
        ? { createMany: { data: input.opportunityIds.map((opportunityId) => ({ opportunityId })) } }
        : undefined,
    },
  });

  await db.activity.create({
    data: {
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
  return db.emailTemplate.findMany({ orderBy: { name: "asc" } });
}

export type TemplateInput = { name: string; subject: string; bodyHtml: string };

export async function createTemplate(input: TemplateInput) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const name = input.name.trim();
  if (!name) throw new Error("Name is required");

  const template = await db.emailTemplate.create({
    data: { name, subject: input.subject.trim(), bodyHtml: input.bodyHtml, createdById: session.user.id },
  });

  revalidatePath("/settings/email-templates");
  return template;
}

export async function updateTemplate(id: string, input: TemplateInput) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const name = input.name.trim();
  if (!name) throw new Error("Name is required");

  const template = await db.emailTemplate.update({
    where: { id },
    data: { name, subject: input.subject.trim(), bodyHtml: input.bodyHtml },
  });

  revalidatePath("/settings/email-templates");
  return template;
}

export async function deleteTemplate(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await db.emailTemplate.delete({ where: { id } });
  revalidatePath("/settings/email-templates");
}

export async function syncContactEmails(personId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const newCount = await syncPersonEmailThreads(session.user.id, personId);
  revalidatePath(`/contacts/${personId}`);
  return newCount;
}
