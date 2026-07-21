"use server";

import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { signIn, INVITE_TOKEN_COOKIE } from "@/lib/auth";

export async function acceptInviteAndSignIn(token: string) {
  const invite = await db.workspaceInvite.findUnique({ where: { token } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    throw new Error("This invite link is invalid or has expired.");
  }

  // Cookie setting requires a Server Function/Route Handler, not Server Component render —
  // this action is the entry point specifically so the cookie is written before redirecting
  // into Google's OAuth round-trip. Read back in auth.ts's signIn callback and createUser event.
  (await cookies()).set(INVITE_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes — just long enough to complete the OAuth round-trip
    path: "/",
  });

  await signIn("google", { redirectTo: "/onboarding" });
}
