import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/signup", "/auth-error"];

export default auth((req) => {
  const isPublic = PUBLIC_PATHS.includes(req.nextUrl.pathname) || req.nextUrl.pathname.startsWith("/invite/");
  if (!req.auth && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  // api/track must stay excluded — the open-tracking pixel is fetched by the recipient's
  // email client, which has no CRM session, so it always fails the auth check and never
  // reaches the route handler if this guard applies to it.
  // api/twilio must stay excluded too — Twilio's servers call these webhooks directly
  // (TwiML request, recording-status callback) with no CRM session cookie either.
  // api/stripe must stay excluded too — same reasoning, Stripe's servers POST the webhook
  // directly with a signature header instead of a session cookie.
  // /invite/[token] must stay reachable logged-out — that's the whole point, an invited
  // person who doesn't have an account (or session) yet needs to open the link and sign in.
  matcher: ["/((?!api/auth|api/track|api/twilio|api/stripe|_next/static|_next/image|favicon.ico).*)"],
};
