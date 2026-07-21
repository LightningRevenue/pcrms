"use server";

import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { decideSignIn, ensureWorkspaceMembership } from "@/lib/workspace";
import { signIn, INVITE_TOKEN_COOKIE } from "@/lib/auth";

export type SignupInput = { name: string; email: string; password: string };

// Separate entry point for /invite/[token]'s email+password form — unlike plain signup(),
// the email is fixed to whatever the invite was sent to (never taken from user input), so
// there's no way to fat-finger a different address and get a confusing decideSignIn
// rejection instead of just joining the workspace you were actually invited to.
export async function signupWithInvite(token: string, input: { name: string; password: string }) {
  const invite = await db.workspaceInvite.findUnique({ where: { token } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    throw new Error("This invite link is invalid or has expired.");
  }

  const name = input.name.trim();
  if (!name) throw new Error("Name is required");
  if (input.password.length < 8) throw new Error("Password must be at least 8 characters");

  const email = invite.email.toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) throw new Error("An account with this email already exists. Try signing in instead.");

  const passwordHash = await hashPassword(input.password);
  const user = await db.user.create({ data: { name, email, passwordHash } });
  await ensureWorkspaceMembership(user.id, email, token);

  await signIn("credentials", { email, password: input.password, redirectTo: "/onboarding" });
}

// Credentials sign-ins never fire Auth.js's createUser event (that only runs for
// adapter-driven OAuth/email flows) — so unlike Google sign-in, this action has to do the
// User-row creation AND the workspace assignment itself, using the same decideSignIn /
// ensureWorkspaceMembership rules Google sign-in uses, so both entry points land in the
// same place (invite honored, personal domains rejected, one workspace per company domain).
export async function signup(input: SignupInput) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!name) throw new Error("Name is required");
  if (!email) throw new Error("Email is required");
  if (password.length < 8) throw new Error("Password must be at least 8 characters");

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) throw new Error("An account with this email already exists. Try signing in instead.");

  const inviteToken = (await cookies()).get(INVITE_TOKEN_COOKIE)?.value ?? null;
  const decision = await decideSignIn(email, inviteToken);
  if (!decision.allow) throw new Error(decision.reason);

  const passwordHash = await hashPassword(password);
  const user = await db.user.create({ data: { name, email, passwordHash } });
  await ensureWorkspaceMembership(user.id, email, inviteToken);
  if (inviteToken) (await cookies()).delete(INVITE_TOKEN_COOKIE);

  await signIn("credentials", { email, password, redirectTo: "/onboarding" });
}
