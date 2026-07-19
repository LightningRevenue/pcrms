"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export type SequenceStepType = "email" | "task" | "note";

export type SequenceStepInput = {
  type: SequenceStepType;
  delayDays: number;
  delayHours: number;
  templateId?: string | null;
  subject?: string;
  bodyHtml?: string;
  taskTitle?: string;
  taskDescription?: string;
  taskType?: string;
  taskPriority?: string;
  noteBody?: string;
};

export async function listSequences() {
  return db.sequence.findMany({
    include: { createdBy: true, _count: { select: { steps: true, enrollments: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listActiveSequencesForEnrollment() {
  return db.sequence.findMany({
    where: { active: true, steps: { some: {} } },
    include: { _count: { select: { steps: true } } },
    orderBy: { name: "asc" },
  });
}

export async function getSequence(id: string) {
  return db.sequence.findUnique({
    where: { id },
    include: {
      steps: { orderBy: { order: "asc" }, include: { template: true } },
      enrollments: { include: { person: true }, orderBy: { enrolledAt: "desc" } },
    },
  });
}

export async function createSequence(name: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");

  const sequence = await db.sequence.create({ data: { name: trimmed, createdById: session.user.id } });
  revalidatePath("/sequences");
  return sequence;
}

export async function toggleSequenceActive(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const sequence = await db.sequence.findUniqueOrThrow({ where: { id } });
  await db.sequence.update({ where: { id }, data: { active: !sequence.active } });
  revalidatePath("/sequences");
  revalidatePath(`/sequences/${id}`);
}

export async function deleteSequence(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await db.sequence.delete({ where: { id } });
  revalidatePath("/sequences");
}

export async function addSequenceStep(sequenceId: string, input: SequenceStepInput) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const last = await db.sequenceStep.findFirst({
    where: { sequenceId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const step = await db.sequenceStep.create({
    data: {
      sequenceId,
      order: (last?.order ?? -1) + 1,
      type: input.type,
      delayDays: input.delayDays,
      delayHours: input.delayHours,
      templateId: input.templateId || null,
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      taskTitle: input.taskTitle,
      taskDescription: input.taskDescription,
      taskType: input.taskType,
      taskPriority: input.taskPriority,
      noteBody: input.noteBody,
    },
  });

  revalidatePath(`/sequences/${sequenceId}`);
  return step;
}

export async function deleteSequenceStep(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const step = await db.sequenceStep.delete({ where: { id } });
  revalidatePath(`/sequences/${step.sequenceId}`);
}

export async function reorderSequenceSteps(sequenceId: string, orderedIds: string[]) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await Promise.all(orderedIds.map((id, i) => db.sequenceStep.update({ where: { id }, data: { order: i } })));
  revalidatePath(`/sequences/${sequenceId}`);
}

export async function enrollPersonInSequence(sequenceId: string, personId: string, startAt?: Date) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const [sequence, existing] = await Promise.all([
    db.sequence.findUniqueOrThrow({ where: { id: sequenceId }, include: { steps: true } }),
    db.sequenceEnrollment.findUnique({ where: { sequenceId_personId: { sequenceId, personId } } }),
  ]);
  if (existing) throw new Error("Contact is already enrolled in this sequence");
  if (sequence.steps.length === 0) throw new Error("Add at least one step before enrolling contacts");

  const runsFrom = startAt ?? new Date();
  const enrollment = await db.sequenceEnrollment.create({
    data: { sequenceId, personId, enrolledById: session.user.id },
  });

  await db.sequenceStepRun.createMany({
    data: sequence.steps.map((step) => ({
      enrollmentId: enrollment.id,
      stepId: step.id,
      scheduledFor: new Date(runsFrom.getTime() + (step.delayDays * 24 + step.delayHours) * 60 * 60 * 1000),
    })),
  });

  revalidatePath(`/sequences/${sequenceId}`);
  revalidatePath(`/contacts/${personId}`);
  return enrollment;
}

export async function enrollPeopleInSequence(sequenceId: string, personIds: string[], startAt?: Date) {
  const results: { personId: string; ok: boolean; error?: string }[] = [];
  for (const personId of personIds) {
    try {
      await enrollPersonInSequence(sequenceId, personId, startAt);
      results.push({ personId, ok: true });
    } catch (e) {
      results.push({ personId, ok: false, error: e instanceof Error ? e.message : "Failed to enroll" });
    }
  }
  return results;
}

export async function searchPeopleForSequence(sequenceId: string, query: string) {
  const q = query.trim();
  if (!q) return [];

  const people = await db.person.findMany({
    where: {
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { firstName: "asc" },
    take: 15,
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  const enrolled = await db.sequenceEnrollment.findMany({
    where: { sequenceId, personId: { in: people.map((p) => p.id) } },
    select: { personId: true },
  });
  const enrolledIds = new Set(enrolled.map((e) => e.personId));

  return people.map((p) => ({
    id: p.id,
    name: [p.firstName, p.lastName].filter(Boolean).join(" "),
    email: p.email,
    alreadyEnrolled: enrolledIds.has(p.id),
  }));
}

export async function cancelEnrollment(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const enrollment = await db.sequenceEnrollment.update({
    where: { id },
    data: { status: "cancelled", completedAt: new Date() },
  });
  await db.sequenceStepRun.updateMany({
    where: { enrollmentId: id, status: "pending" },
    data: { status: "skipped" },
  });

  revalidatePath(`/sequences/${enrollment.sequenceId}`);
  revalidatePath(`/contacts/${enrollment.personId}`);
}

export async function listSequencesForPerson(personId: string) {
  return db.sequenceEnrollment.findMany({
    where: { personId },
    include: { sequence: true },
    orderBy: { enrolledAt: "desc" },
  });
}
