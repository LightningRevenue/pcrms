"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { getTwilioAccount } from "@/lib/actions/twilio";
import { isVoiceReady } from "@/lib/twilio-helpers";
import { assertLimit } from "@/lib/entitlements";

export const CALL_DISPOSITIONS = [
  { value: "interested", label: "Interested" },
  { value: "not-interested", label: "Not interested" },
  { value: "voicemail", label: "Voicemail" },
  { value: "callback", label: "Callback" },
  { value: "no-answer", label: "No answer" },
  { value: "wrong-number", label: "Wrong number" },
] as const;
type CallDisposition = (typeof CALL_DISPOSITIONS)[number]["value"];

export async function getVoiceStatus() {
  const account = await getTwilioAccount();
  return { ready: isVoiceReady(account) };
}

// Creates the Call row before the browser SDK places the call, so the row exists
// (status "initiated") even if the call never connects. The webhook can't create
// it because Twilio's request has no personId/createdById to attach — those only
// exist in the CRM's own session context.
export async function startCall(personId: string) {
  const { userId, workspaceId } = await requireWorkspace();
  await assertLimit(workspaceId, "voice_calling_feature");
  await assertLimit(workspaceId, "calls_monthly");

  const person = await db.person.findUniqueOrThrow({ where: { id: personId, workspaceId } });
  if (!person.phone) throw new Error("This contact has no phone number");

  const call = await db.call.create({
    data: {
      workspaceId,
      toNumber: person.phone,
      personId,
      createdById: userId,
    },
  });

  return { callId: call.id, toNumber: person.phone };
}

export async function listCallsForPerson(personId: string) {
  const { workspaceId } = await requireWorkspace();
  return db.call.findMany({
    where: { workspaceId, personId },
    orderBy: { startedAt: "desc" },
    include: { createdBy: true },
  });
}

export async function setCallDisposition(callId: string, disposition: CallDisposition | null, personId: string) {
  const { workspaceId } = await requireWorkspace();
  if (disposition !== null && !CALL_DISPOSITIONS.some((d) => d.value === disposition)) {
    throw new Error("Unknown disposition");
  }
  await db.call.update({ where: { id: callId, workspaceId }, data: { disposition } });
  revalidatePath(`/contacts/${personId}`);
}

// Full-replace diff: deletes every existing link then recreates from opportunityIds — the set
// is always small (a handful of deals per call at most), so this is simpler than computing an
// add/remove delta for a per-row list picker.
export async function setCallOpportunities(callId: string, opportunityIds: string[], personId: string) {
  const { workspaceId } = await requireWorkspace();
  await db.$transaction([
    db.callOpportunity.deleteMany({ where: { callId, workspaceId } }),
    ...(opportunityIds.length > 0
      ? [
          db.callOpportunity.createMany({
            data: opportunityIds.map((opportunityId) => ({ callId, opportunityId, workspaceId })),
          }),
        ]
      : []),
  ]);
  revalidatePath(`/contacts/${personId}`);
}
