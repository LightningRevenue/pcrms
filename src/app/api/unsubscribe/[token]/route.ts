import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/gdpr";

async function unsubscribe(token: string) {
  const personId = verifyUnsubscribeToken(token);
  if (!personId) return false;

  // Idempotent — clicking twice, or a mail client prefetching the link, shouldn't error or
  // overwrite an earlier unsubscribedAt timestamp.
  await db.person.updateMany({ where: { id: personId, unsubscribedAt: null }, data: { unsubscribedAt: new Date() } });
  return true;
}

function confirmationPage() {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Unsubscribed</title>
<style>body{font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:80px auto;padding:0 24px;color:#1a1a1a;text-align:center}</style>
</head><body>
<h1 style="font-size:18px;font-weight:600;">You've been unsubscribed</h1>
<p style="font-size:14px;color:#666;">You won't receive any more emails from us.</p>
</body></html>`;
}

// Regular link click, opened in a browser — shows a confirmation page.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await unsubscribe(token);
  return new NextResponse(confirmationPage(), { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// RFC 8058 one-click unsubscribe — Gmail/Outlook/etc. POST here with no page rendered when a
// recipient uses the mail client's own native "Unsubscribe" button (see List-Unsubscribe-Post
// header set alongside List-Unsubscribe in every outbound Email — mailer-helpers.ts).
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ok = await unsubscribe(token);
  return new NextResponse(null, { status: ok ? 200 : 400 });
}
