import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/signup", "/auth-error"];

// Phones only — the full CRM (kanban boards, drag-reorder sidebar, wide tables) doesn't fit
// a small screen, so phones get routed to the dedicated (mobile) route group instead. Tablets
// and desktop keep the full app. "Desktop site" link in mobile-nav sets crm_view=desktop to
// escape hatch back out for the rare person who wants the full app on their phone anyway.
const MOBILE_UA = /iPhone|Android.*Mobile|Windows Phone/i;
const MOBILE_PATHS = ["/m"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/invite/");
  if (!req.auth && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (req.auth && !isPublic && !pathname.startsWith("/api")) {
    const isMobileUA = MOBILE_UA.test(req.headers.get("user-agent") ?? "");
    const wantsDesktop = req.cookies.get("crm_view")?.value === "desktop";
    const onMobilePath = MOBILE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

    if (isMobileUA && !wantsDesktop && !onMobilePath) {
      return NextResponse.redirect(new URL("/m", req.nextUrl));
    }
    if ((!isMobileUA || wantsDesktop) && onMobilePath) {
      return NextResponse.redirect(new URL("/", req.nextUrl));
    }
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
  // api/unsubscribe must stay excluded too — clicked by the email recipient, who has no CRM
  // session either; the route verifies its own HMAC-signed token instead (see lib/gdpr.ts).
  // /invite/[token] must stay reachable logged-out — that's the whole point, an invited
  // person who doesn't have an account (or session) yet needs to open the link and sign in.
  matcher: ["/((?!api/auth|api/track|api/twilio|api/stripe|api/unsubscribe|_next/static|_next/image|favicon.ico).*)"],
};
