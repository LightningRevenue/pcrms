"use server";

import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";

export type SequenceSummary = {
  id: string;
  name: string;
  active: boolean;
  stepCount: number;
  activeEnrollments: number;
  completedEnrollments: number;
  cancelledEnrollments: number;
  totalEnrollments: number;
};

export async function listSequencePerformance(): Promise<SequenceSummary[]> {
  const { workspaceId } = await requireWorkspace();

  const sequences = await db.sequence.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { steps: true } },
      enrollments: { select: { status: true } },
    },
  });

  return sequences.map((s) => {
    const active = s.enrollments.filter((e) => e.status === "active").length;
    const completed = s.enrollments.filter((e) => e.status === "completed").length;
    const cancelled = s.enrollments.filter((e) => e.status === "cancelled").length;
    return {
      id: s.id,
      name: s.name,
      active: s.active,
      stepCount: s._count.steps,
      activeEnrollments: active,
      completedEnrollments: completed,
      cancelledEnrollments: cancelled,
      totalEnrollments: s.enrollments.length,
    };
  });
}

export type StepPerformance = {
  stepId: string;
  order: number;
  type: string;
  label: string;
  sent: number;
  pending: number;
  failed: number;
  skipped: number;
};

// Per-step breakdown for one sequence — "skipped" is largely the reply-triggered cancellation
// (cancelActiveEmailStepsOnReply) marking every later pending email step skipped once someone
// replies, so a high skip rate on later steps is a *good* sign (people are engaging early),
// not sequence steps failing to fire.
export async function getSequenceStepPerformance(sequenceId: string): Promise<StepPerformance[]> {
  const { workspaceId } = await requireWorkspace();

  const steps = await db.sequenceStep.findMany({
    where: { workspaceId, sequenceId },
    orderBy: { order: "asc" },
    include: { runs: { select: { status: true } } },
  });

  return steps.map((step) => ({
    stepId: step.id,
    order: step.order,
    type: step.type,
    label: step.type === "email" ? "Email" : step.type === "task" ? "Task" : "Note",
    sent: step.runs.filter((r) => r.status === "sent").length,
    pending: step.runs.filter((r) => r.status === "pending").length,
    failed: step.runs.filter((r) => r.status === "failed").length,
    skipped: step.runs.filter((r) => r.status === "skipped").length,
  }));
}

export type EnrollmentDrillDownRow = {
  id: string;
  personId: string;
  personName: string;
  status: string;
  enrolledAt: Date;
};

export async function getSequenceEnrollments(sequenceId: string, status?: "active" | "completed" | "cancelled"): Promise<EnrollmentDrillDownRow[]> {
  const { workspaceId } = await requireWorkspace();

  const enrollments = await db.sequenceEnrollment.findMany({
    where: { workspaceId, sequenceId, ...(status ? { status } : {}) },
    orderBy: { enrolledAt: "desc" },
    include: { person: { select: { firstName: true, lastName: true } } },
  });

  return enrollments.map((e) => ({
    id: e.id,
    personId: e.personId,
    personName: [e.person.firstName, e.person.lastName].filter(Boolean).join(" ") || "Untitled",
    status: e.status,
    enrolledAt: e.enrolledAt,
  }));
}
