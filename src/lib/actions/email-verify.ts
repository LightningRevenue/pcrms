"use server";

import { db } from "@/lib/db";
import { requireWorkspace, requireWorkspaceAdmin, personVisibilityFilter } from "@/lib/workspace";
import { assertLimit, checkLimit } from "@/lib/entitlements";
import crypto from "node:crypto";

export type EmailVerifyResult = {
  valid: boolean;
  catchAll: boolean;
  reason: string;
};

function statusOf(data: { valid: boolean; catchAll: boolean }) {
  if (data.catchAll) return "catch-all";
  return data.valid ? "valid" : "invalid";
}

async function callVerifyApi(email: string): Promise<EmailVerifyResult> {
  const res = await fetch(process.env.SMTP_VERIFY_API_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SMTP_VERIFY_API_KEY}`,
    },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(`Verification service error (${res.status})`);
  const data = await res.json();
  return { valid: data.valid, catchAll: data.catchAll, reason: data.reason };
}

export async function verifyPersonEmail(personId: string): Promise<EmailVerifyResult> {
  const ctx = await requireWorkspace();
  const person = await db.person.findUnique({
    where: { id: personId, workspaceId: ctx.workspaceId, ...personVisibilityFilter(ctx) },
    select: { email: true },
  });
  if (!person?.email) throw new Error("Contact has no email address");

  await assertLimit(ctx.workspaceId, "email_verifications_monthly");
  const result = await callVerifyApi(person.email);

  await db.person.update({
    where: { id: personId },
    data: { emailVerifiedStatus: statusOf(result), emailVerifiedAt: new Date(), emailVerifiedReason: result.reason },
  });

  return result;
}

export type VerifierPerson = {
  id: string;
  name: string;
  email: string;
  emailVerifiedStatus: string | null;
  emailVerifiedAt: Date | null;
  emailVerifiedReason: string | null;
};

export async function searchPeopleForVerification(query: string): Promise<VerifierPerson[]> {
  const ctx = await requireWorkspaceAdmin();
  const people = await db.person.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
      email: { not: null },
      ...(query.trim()
        ? {
            OR: [
              { email: { contains: query, mode: "insensitive" } },
              { firstName: { contains: query, mode: "insensitive" } },
              { lastName: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      emailVerifiedStatus: true,
      emailVerifiedAt: true,
      emailVerifiedReason: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return people.map((p) => ({
    id: p.id,
    name: [p.firstName, p.lastName].filter(Boolean).join(" "),
    email: p.email!,
    emailVerifiedStatus: p.emailVerifiedStatus,
    emailVerifiedAt: p.emailVerifiedAt,
    emailVerifiedReason: p.emailVerifiedReason,
  }));
}

export async function getUnverifiedCount(): Promise<number> {
  const ctx = await requireWorkspaceAdmin();
  return db.person.count({
    where: { workspaceId: ctx.workspaceId, deletedAt: null, email: { not: null }, emailVerifiedStatus: null },
  });
}

export async function getVerificationLimit() {
  const ctx = await requireWorkspaceAdmin();
  return checkLimit(ctx.workspaceId, "email_verifications_monthly");
}

// ponytail: in-memory batch progress, not persisted — fine since batches run to completion
// within one server process lifetime (seconds to a couple minutes for realistic volumes).
// Move to a DB row + BullMQ worker if verification needs to survive a server restart.
type BatchProgress = { total: number; done: number; valid: number; invalid: number; catchAll: number; finished: boolean };
const batches = new Map<string, BatchProgress>();

const CONCURRENCY = 8;

async function runBatch(batchId: string, workspaceId: string, people: { id: string; email: string }[]) {
  const progress = batches.get(batchId)!;
  let cursor = 0;

  async function worker() {
    while (cursor < people.length) {
      const person = people[cursor++];
      try {
        const result = await callVerifyApi(person.email);
        await db.person.update({
          where: { id: person.id },
          data: { emailVerifiedStatus: statusOf(result), emailVerifiedAt: new Date(), emailVerifiedReason: result.reason },
        });
        if (result.catchAll) progress.catchAll++;
        else if (result.valid) progress.valid++;
        else progress.invalid++;
      } catch (e) {
        await db.person.update({
          where: { id: person.id },
          data: {
            emailVerifiedStatus: "invalid",
            emailVerifiedAt: new Date(),
            emailVerifiedReason: e instanceof Error ? e.message : "Verification failed",
          },
        });
        progress.invalid++;
      }
      progress.done++;
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, people.length) }, worker));
  progress.finished = true;
  // Keep the finished record around briefly so a final poll can read it, then drop it.
  setTimeout(() => batches.delete(batchId), 5 * 60 * 1000);
}

async function startBatch(workspaceId: string, people: { id: string; email: string }[]): Promise<string> {
  await assertLimit(workspaceId, "email_verifications_monthly");
  const batchId = crypto.randomUUID();
  batches.set(batchId, { total: people.length, done: 0, valid: 0, invalid: 0, catchAll: 0, finished: false });
  runBatch(batchId, workspaceId, people); // fire and forget; poll getBatchProgress for status
  return batchId;
}

export async function verifyPeopleBatch(personIds: string[]): Promise<string> {
  const ctx = await requireWorkspaceAdmin();
  const people = await db.person.findMany({
    where: { id: { in: personIds }, workspaceId: ctx.workspaceId, deletedAt: null, email: { not: null } },
    select: { id: true, email: true },
  });
  if (!people.length) throw new Error("No verifiable contacts selected");
  return startBatch(ctx.workspaceId, people.map((p) => ({ id: p.id, email: p.email! })));
}

export async function verifyAllUnverified(): Promise<string> {
  const ctx = await requireWorkspaceAdmin();
  const people = await db.person.findMany({
    where: { workspaceId: ctx.workspaceId, deletedAt: null, email: { not: null }, emailVerifiedStatus: null },
    select: { id: true, email: true },
  });
  if (!people.length) throw new Error("Nothing to verify — every contact already has a status");
  return startBatch(ctx.workspaceId, people.map((p) => ({ id: p.id, email: p.email! })));
}

export async function getBatchProgress(batchId: string): Promise<BatchProgress | null> {
  await requireWorkspaceAdmin();
  return batches.get(batchId) ?? null;
}

export async function getPeopleByStatus(statuses: ("invalid" | "catch-all")[]): Promise<VerifierPerson[]> {
  const ctx = await requireWorkspaceAdmin();
  const people = await db.person.findMany({
    where: { workspaceId: ctx.workspaceId, deletedAt: null, emailVerifiedStatus: { in: statuses } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      emailVerifiedStatus: true,
      emailVerifiedAt: true,
      emailVerifiedReason: true,
    },
    orderBy: { emailVerifiedAt: "desc" },
  });
  return people.map((p) => ({
    id: p.id,
    name: [p.firstName, p.lastName].filter(Boolean).join(" "),
    email: p.email!,
    emailVerifiedStatus: p.emailVerifiedStatus,
    emailVerifiedAt: p.emailVerifiedAt,
    emailVerifiedReason: p.emailVerifiedReason,
  }));
}

// Permanent delete, not soft-delete — the caller (EmailVerifierPanel) shows an explicit
// confirmation step listing every contact by name/email before calling this, since there's
// no undo path here (unlike the Trash flow in trash.ts, which soft-deletes first).
export async function deletePeopleByIds(personIds: string[]): Promise<number> {
  const ctx = await requireWorkspaceAdmin();
  if (!personIds.length) return 0;
  const result = await db.person.deleteMany({ where: { id: { in: personIds }, workspaceId: ctx.workspaceId } });
  return result.count;
}
