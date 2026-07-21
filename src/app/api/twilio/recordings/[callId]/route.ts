import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTwilioAccount } from "@/lib/actions/twilio";

// Twilio's RecordingUrl requires HTTP Basic Auth (Account SID/Auth Token), which is why
// pointing an <audio> tag straight at it triggers a browser login prompt. This route sits
// in front: it checks the CRM session, then fetches the recording server-side (where the
// Twilio credentials live) and streams it back with no auth required from the browser.
//
// Excluded from the auth proxy matcher along with the rest of /api/twilio, so — unlike the
// other routes there, which are Twilio's own webhooks — this one checks the session itself.
export async function GET(request: Request, { params }: { params: Promise<{ callId: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !session.user.workspaceId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { callId } = await params;
  const call = await db.call.findUnique({ where: { id: callId, workspaceId: session.user.workspaceId } });
  if (!call?.recordingUrl) {
    return NextResponse.json({ error: "No recording for this call" }, { status: 404 });
  }

  const account = await getTwilioAccount();
  if (!account) {
    return NextResponse.json({ error: "Twilio is not configured" }, { status: 400 });
  }

  const auth64 = Buffer.from(`${account.accountSid}:${account.authToken}`).toString("base64");
  const range = request.headers.get("range");

  const upstream = await fetch(call.recordingUrl, {
    headers: {
      Authorization: `Basic ${auth64}`,
      ...(range ? { Range: range } : {}),
    },
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Could not fetch recording" }, { status: 502 });
  }

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") ?? "audio/mpeg");
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);
  headers.set("Accept-Ranges", "bytes");
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) headers.set("Content-Range", contentRange);
  headers.set("Cache-Control", "private, max-age=3600");

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
