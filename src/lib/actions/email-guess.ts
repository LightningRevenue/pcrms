"use server";

import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import { assertLimit } from "@/lib/entitlements";
import { callVerifyApi } from "@/lib/actions/email-verify";
import { createContact } from "@/lib/actions/contacts";

function patterns(first: string, last: string, domain: string): string[] {
  const f = first.toLowerCase().trim();
  const l = last.toLowerCase().trim();
  const fi = f[0] ?? "";
  const li = l[0] ?? "";
  const candidates = l
    ? [
        `${f}.${l}`,
        `${f}${l}`,
        `${fi}${l}`,
        `${fi}.${l}`,
        `${f}${li}`,
        `${f}.${li}`,
        `${f}`,
        `${l}.${f}`,
        `${l}${f}`,
        `${f}_${l}`,
        `${fi}_${l}`,
      ]
    : [f];
  return [...new Set(candidates)].map((local) => `${local}@${domain}`);
}

export type EmailGuessAttempt = { email: string; valid: boolean; catchAll: boolean; reason: string };
export type EmailGuessResult = { found: string | null; attempts: EmailGuessAttempt[] };

export async function guessEmail(firstName: string, lastName: string, domain: string): Promise<EmailGuessResult> {
  const ctx = await requireWorkspace();
  const first = firstName.trim();
  const domainClean = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!first) throw new Error("First name is required");
  if (!domainClean) throw new Error("Domain is required");

  const attempts: EmailGuessAttempt[] = [];
  for (const email of patterns(first, lastName.trim(), domainClean)) {
    await assertLimit(ctx.workspaceId, "email_verifications_monthly");
    const result = await callVerifyApi(email);
    attempts.push({ email, valid: result.valid, catchAll: result.catchAll, reason: result.reason });
    if (result.valid && !result.catchAll) {
      return { found: email, attempts };
    }
  }
  return { found: null, attempts };
}

export async function createContactFromGuess(
  firstName: string,
  lastName: string,
  email: string
): Promise<string> {
  const personId = await createContact({ firstName, lastName, email });
  await db.person.update({
    where: { id: personId },
    data: { emailVerifiedStatus: "valid", emailVerifiedAt: new Date(), emailVerifiedReason: "Found via Mail Verifier pattern guess" },
  });
  return personId;
}
