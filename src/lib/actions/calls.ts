"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTwilioAccount } from "@/lib/actions/twilio";
import { isVoiceReady } from "@/lib/twilio-helpers";

export async function getVoiceStatus() {
  const account = await getTwilioAccount();
  return { ready: isVoiceReady(account) };
}

// Creates the Call row before the browser SDK places the call, so the row exists
// (status "initiated") even if the call never connects. The webhook can't create
// it because Twilio's request has no personId/createdById to attach — those only
// exist in the CRM's own session context.
export async function startCall(personId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const person = await db.person.findUniqueOrThrow({ where: { id: personId } });
  if (!person.phone) throw new Error("This contact has no phone number");

  const call = await db.call.create({
    data: {
      toNumber: person.phone,
      personId,
      createdById: session.user.id,
    },
  });

  return { callId: call.id, toNumber: person.phone };
}

export async function listCallsForPerson(personId: string) {
  return db.call.findMany({
    where: { personId },
    orderBy: { startedAt: "desc" },
    include: { createdBy: true },
  });
}
