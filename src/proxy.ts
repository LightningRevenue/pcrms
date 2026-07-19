import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((req) => {
  if (!req.auth && req.nextUrl.pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  // api/track must stay excluded — the open-tracking pixel is fetched by the recipient's
  // email client, which has no CRM session, so it always fails the auth check and never
  // reaches the route handler if this guard applies to it.
  matcher: ["/((?!api/auth|api/track|_next/static|_next/image|favicon.ico).*)"],
};
