import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Twilio POSTs here once a call recording finishes processing (recordingStatusCallbackEvent:
// ["completed"] in the /voice route). RecordingUrl needs ".mp3" appended to fetch the audio
// directly; without it Twilio returns a JSON resource description instead.
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const callId = searchParams.get("callId");
  if (!callId) return new NextResponse(null, { status: 204 });

  const form = await request.formData();
  const recordingSid = form.get("RecordingSid")?.toString();
  const recordingUrl = form.get("RecordingUrl")?.toString();
  const recordingDuration = form.get("RecordingDuration")?.toString();

  // No session (Twilio webhook) — updateMany filtered by id alone is fine, callId is
  // the Call's own cuid primary key, already unique with no cross-workspace ambiguity.
  await db.call.updateMany({
    where: { id: callId },
    data: {
      recordingSid,
      recordingUrl: recordingUrl ? `${recordingUrl}.mp3` : undefined,
      recordingDurationSec: recordingDuration ? Number(recordingDuration) : undefined,
    },
  });

  return new NextResponse(null, { status: 204 });
}
