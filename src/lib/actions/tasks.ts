"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { assertLimit } from "@/lib/entitlements";

export type TaskType = "call" | "email" | "event" | "meet" | "general";
export type TaskPriority = "low" | "medium" | "high";

export type CreateTaskInput = {
  personId: string;
  title: string;
  description?: string;
  type: TaskType;
  due: string;
  priority: TaskPriority;
  opportunityIds?: string[];
};

export async function listTasksForPerson(personId: string) {
  const { workspaceId } = await requireWorkspace();
  return db.task.findMany({
    where: { workspaceId, personId },
    orderBy: [{ done: "asc" }, { dueAt: "asc" }],
  });
}

// One task per person: earliest not-done, or earliest not-done-and-undated last. Keyed by personId for O(1) lookup in the list view.
export async function listNextTasksByPerson(personIds: string[]) {
  const { workspaceId } = await requireWorkspace();
  const tasks = await db.task.findMany({
    where: { workspaceId, personId: { in: personIds }, done: false },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  });

  const next = new Map<string, (typeof tasks)[number]>();
  for (const task of tasks) {
    if (!next.has(task.personId)) next.set(task.personId, task);
  }
  return next;
}

export async function listTasksDueToday() {
  const { workspaceId } = await requireWorkspace();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return db.task.findMany({
    where: { workspaceId, dueAt: { gte: start, lt: end } },
    include: { person: true },
    orderBy: [{ done: "asc" }, { dueAt: "asc" }],
  });
}

export async function listTasksWithDueDate() {
  const { workspaceId } = await requireWorkspace();
  return db.task.findMany({
    where: { workspaceId, dueAt: { not: null } },
    include: { person: { include: { company: true } } },
    orderBy: { dueAt: "asc" },
  });
}

export async function createTask(input: CreateTaskInput) {
  const { userId, workspaceId } = await requireWorkspace();
  await assertLimit(workspaceId, "tasks_count");

  const title = input.title.trim();
  if (!title) throw new Error("Title is required");

  await db.task.create({
    data: {
      workspaceId,
      title,
      description: input.description?.trim() || null,
      type: input.type,
      priority: input.priority,
      dueAt: input.due ? new Date(input.due) : null,
      personId: input.personId,
      createdById: userId,
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
      kind: "task_created",
      field: "Task",
      newValue: title,
      actorId: userId,
    },
  });

  revalidatePath(`/contacts/${input.personId}`);
  revalidatePath("/contacts");
  revalidatePath("/tasks");
  revalidatePath("/calendar");
}

export async function rescheduleTask(id: string, dueAt: Date) {
  const { workspaceId } = await requireWorkspace();

  const task = await db.task.update({ where: { id, workspaceId }, data: { dueAt } });

  revalidatePath(`/contacts/${task.personId}`);
  revalidatePath("/tasks");
  revalidatePath("/calendar");
}

export type UpdateTaskInput = {
  title: string;
  description?: string;
  type: TaskType;
  due: string;
  priority: TaskPriority;
};

export async function updateTask(id: string, input: UpdateTaskInput) {
  const { workspaceId } = await requireWorkspace();

  const title = input.title.trim();
  if (!title) throw new Error("Title is required");

  const task = await db.task.update({
    where: { id, workspaceId },
    data: {
      title,
      description: input.description?.trim() || null,
      type: input.type,
      priority: input.priority,
      dueAt: input.due ? new Date(input.due) : null,
    },
  });

  revalidatePath(`/contacts/${task.personId}`);
  revalidatePath("/contacts");
  revalidatePath("/tasks");
  revalidatePath("/calendar");
}

export async function toggleTask(id: string) {
  const { userId, workspaceId } = await requireWorkspace();

  const task = await db.task.findUniqueOrThrow({ where: { id, workspaceId } });
  const done = !task.done;
  await db.task.update({ where: { id, workspaceId }, data: { done } });

  if (done) {
    await db.activity.create({
      data: {
        workspaceId,
        entityType: "person",
        entityId: task.personId,
        kind: "task_completed",
        field: "Task",
        newValue: task.title,
        actorId: userId,
      },
    });
  }

  revalidatePath(`/contacts/${task.personId}`);
  revalidatePath("/contacts");
  revalidatePath("/tasks");
  revalidatePath("/calendar");
}
