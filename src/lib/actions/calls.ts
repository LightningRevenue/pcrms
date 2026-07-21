"use server";

import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { getTwilioAccount } from "@/lib/actions/twilio";
import { isVoiceReady } from "@/lib/twilio-helpers";
import { assertLimit } from "@/lib/entitlements";

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
