import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function formatDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Twilio POSTs here (the <Dial> action callback) once the dialed leg ends, with the
// final DialCallStatus/DialCallDuration for that leg.
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const callId = searchParams.get("callId");
  if (!callId) return new NextResponse(null, { status: 204 });

  const existing = await db.call.findUnique({ where: { id: callId } });
  if (!existing) return new NextResponse(null, { status: 204 });

  const form = await request.formData();
  const dialStatus = form.get("DialCallStatus")?.toString() ?? "completed"; // "completed" | "no-answer" | "busy" | "failed"
  const duration = form.get("DialCallDuration")?.toString();
  const durationSec = duration ? Number(duration) : undefined;

  await db.call.update({
    where: { id: callId },
    data: { status: dialStatus, endedAt: new Date(), durationSec },
  });

  if (existing.personId) {
    await db.activity.create({
      data: {
        workspaceId: existing.workspaceId,
        entityType: "person",
        entityId: existing.personId,
        kind: "call_logged",
        field: "Call",
        newValue:
          dialStatus === "completed" && durationSec
            ? `Call to ${existing.toNumber} (${formatDuration(durationSec)})`
            : `Call to ${existing.toNumber} — ${dialStatus}`,
        actorId: existing.createdById,
      },
    });
  }

  return new NextResponse(null, { status: 204 });
}
