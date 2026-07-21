import { NextResponse } from "next/server";
import twilio from "twilio";
import { db } from "@/lib/db";
import { getTrackingBaseUrlForWorker } from "@/lib/workspace-settings";

// TwiML webhook Twilio hits when the browser SDK (device.connect) places a call
// through the TwiML App. Twilio POSTs the custom params passed from the browser
// (To, CallId) as form fields here — this responds with instructions to dial the
// contact's number, recording the call, with status callbacks routed back to us.
export async function POST(request: Request) {
  const form = await request.formData();
  const to = form.get("To")?.toString();
  const callId = form.get("CallId")?.toString();
  const callSid = form.get("CallSid")?.toString();

  // No session here (Twilio is calling this webhook directly) — resolve the workspace
  // via the Call row the browser SDK created (see startCall in actions/calls.ts) before
  // placing this call, so the right workspace's TwilioAccount (caller ID) is used.
  const call = callId ? await db.call.findUnique({ where: { id: callId } }) : null;
  const account = call ? await db.twilioAccount.findUnique({ where: { workspaceId: call.workspaceId } }) : null;
  const twiml = new twilio.twiml.VoiceResponse();

  if (!to || !account) {
    twiml.say("This call could not be connected.");
    return new NextResponse(twiml.toString(), { headers: { "Content-Type": "text/xml" } });
  }

  if (callId && callSid) {
    await db.call.updateMany({ where: { id: callId, workspaceId: call!.workspaceId }, data: { twilioCallSid: callSid, status: "ringing" } });
  }

  const baseUrl = await getTrackingBaseUrlForWorker();
  const dial = twiml.dial({
    callerId: account.phoneNumber,
    record: "record-from-answer",
    recordingStatusCallback: `${baseUrl}/api/twilio/recording-status${callId ? `?callId=${callId}` : ""}`,
    recordingStatusCallbackEvent: ["completed"],
    action: `${baseUrl}/api/twilio/voice-status${callId ? `?callId=${callId}` : ""}`,
  });
  dial.number(to);

  return new NextResponse(twiml.toString(), { headers: { "Content-Type": "text/xml" } });
}
