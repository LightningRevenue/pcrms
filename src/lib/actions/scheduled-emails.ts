"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import { assertNotUnsubscribed } from "@/lib/gdpr";

export type ScheduleEmailInput = {
  personId: string;
  /** Composer's `fromId`: "gmail" or a MailboxAccount id. */
  fromId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  replyToEmailId?: string;
  opportunityIds?: string[];
  /** ISO string from the composer's datetime-local input. */
  scheduledFor: string;
};

export async function scheduleEmail(input: ScheduleEmailInput) {
  const { userId, workspaceId } = await requireWorkspace();

  if (input.to.length === 0) throw new Error("Add at least one recipient");
  if (!input.subject.trim()) throw new Error("Add a subject");

  const when = new Date(input.scheduledFor);
  if (Number.isNaN(when.getTime())) throw new Error("Pick a valid date and time");
  // A minute of slack, so "in 1 minute" isn't rejected by clock skew between browser and server.
  if (when.getTime() < Date.now() - 60_000) throw new Error("Pick a time in the future");

  // Checked now for immediate feedback; re-checked at send time too, since a contact can
  // unsubscribe in the gap.
  await assertNotUnsubscribed(input.personId);

  // Scope the referenced rows to this workspace before storing them.
  const person = await db.person.findFirst({ where: { id: input.personId, workspaceId }, select: { id: true } });
  if (!person) throw new Error("Contact not found");

  const mailboxAccountId = input.fromId === "gmail" ? null : input.fromId;
  if (mailboxAccountId) {
    const mailbox = await db.mailboxAccount.findFirst({
      where: { id: mailboxAccountId, workspaceId },
      select: { id: true },
    });
    if (!mailbox) throw new Error("Sending inbox not found");
  }

  const scheduled = await db.scheduledEmail.create({
    data: {
      workspaceId,
      personId: input.personId,
      senderId: userId,
      mailboxAccountId,
      to: input.to,
      cc: input.cc ?? [],
      bcc: input.bcc ?? [],
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      replyToEmailId: input.replyToEmailId,
      opportunityIds: input.opportunityIds ?? [],
      scheduledFor: when,
    },
  });

  revalidatePath(`/contacts/${input.personId}`);
  revalidatePath(`/lead/${input.personId}`);
  return { id: scheduled.id, scheduledFor: scheduled.scheduledFor };
}

export async function listScheduledEmailsForPerson(personId: string) {
  const { workspaceId } = await requireWorkspace();
  return db.scheduledEmail.findMany({
    where: { workspaceId, personId, status: "pending" },
    orderBy: { scheduledFor: "asc" },
    select: { id: true, subject: true, scheduledFor: true, to: true, status: true },
  });
}

// Everything still queued in the workspace, for a "Scheduled" view. Failed rows are included
// so a revoked Gmail token or dead SMTP host doesn't fail silently.
export async function listScheduledEmails() {
  const { workspaceId } = await requireWorkspace();
  return db.scheduledEmail.findMany({
    where: { workspaceId, status: { in: ["pending", "failed"] } },
    orderBy: { scheduledFor: "asc" },
    include: {
      person: { select: { id: true, firstName: true, lastName: true, email: true } },
      sender: { select: { id: true, name: true, email: true } },
      mailboxAccount: { select: { id: true, email: true, label: true } },
    },
  });
}

export async function cancelScheduledEmail(id: string) {
  const { workspaceId } = await requireWorkspace();
  // updateMany + status guard so cancelling something the worker just picked up can't
  // retroactively mark a delivered email as cancelled.
  const res = await db.scheduledEmail.updateMany({
    where: { id, workspaceId, status: "pending" },
    data: { status: "cancelled" },
  });
  if (res.count === 0) throw new Error("That email has already been sent or cancelled.");

  revalidatePath("/inbox");
  return { cancelled: res.count };
}

// Moves a queued email to a new time. Same status guard as cancel.
export async function rescheduleEmail(id: string, scheduledFor: string) {
  const { workspaceId } = await requireWorkspace();

  const when = new Date(scheduledFor);
  if (Number.isNaN(when.getTime())) throw new Error("Pick a valid date and time");
  if (when.getTime() < Date.now() - 60_000) throw new Error("Pick a time in the future");

  const res = await db.scheduledEmail.updateMany({
    where: { id, workspaceId, status: "pending" },
    data: { scheduledFor: when },
  });
  if (res.count === 0) throw new Error("That email has already been sent or cancelled.");

  revalidatePath("/inbox");
  return { scheduledFor: when };
}
