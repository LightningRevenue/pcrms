import { NextRequest, NextResponse } from "next/server";

// Escape hatch out of the phone-forced /m redirect (see src/proxy.ts) — a person on a phone
// who genuinely wants the full desktop CRM can opt out via this cookie.
export async function GET(req: NextRequest) {
  const view = req.nextUrl.searchParams.get("view") === "desktop" ? "desktop" : "mobile";
  const res = NextResponse.redirect(new URL(view === "desktop" ? "/" : "/m", req.url));
  if (view === "desktop") {
    res.cookies.set("crm_view", "desktop", { maxAge: 60 * 60 * 24 * 30, path: "/" });
  } else {
    res.cookies.delete("crm_view");
  }
  return res;
}
