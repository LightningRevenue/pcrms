import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isFreeEmailDomain } from "@/lib/free-email-domains";

export type SignInDecision =
  | { allow: true }
  | { allow: false; reason: string };

// Called from auth.ts's signIn callback for EVERY sign-in attempt (existing users and
// brand-new ones alike). Existing users (already have a WorkspaceMember row) are always
// allowed straight through — this only gates whether a brand-new User is allowed to be
// created at all, and if so, decides which Workspace/role they'll land in once the Prisma
// adapter creates their User row and fires createUser (see ensureWorkspaceMembership below).
//
// Rules for a brand-new sign-in, in order:
//  1. A valid, unexpired, unconsumed invite for this exact email always wins — allowed,
//     regardless of domain state (consumed later in ensureWorkspaceMembership, once the
//     User row actually exists — not here, so a rejected/failed account-creation can't burn
//     a one-time invite).
//  2. Free/personal email domains (gmail.com, etc.) can never self-serve a new workspace.
//  3. First sign-in ever from a given company domain is allowed — it'll create a new
//     Workspace and become its owner.
//  4. Any later sign-in from a domain that already has a workspace, with no matching invite,
//     is rejected — teammates must be invited explicitly, never auto-joined, so nobody
//     accidentally lands in a stranger's workspace just for sharing their email domain.
export async function decideSignIn(email: string, inviteToken?: string | null): Promise<SignInDecision> {
  const existingUser = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) return { allow: true };

  if (inviteToken && (await findValidInvite(inviteToken, email))) return { allow: true };

  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return { allow: false, reason: "Could not determine an email domain." };
  if (isFreeEmailDomain(domain)) {
    return { allow: false, reason: "Sign up with your company email address, not a personal email provider." };
  }

  const existingWorkspace = await db.workspace.findUnique({ where: { emailDomain: domain } });
  if (existingWorkspace) {
    return { allow: false, reason: `A workspace already exists for ${domain}. Ask an existing member to invite you.` };
  }

  return { allow: true };
}

async function findValidInvite(token: string, email: string) {
  const invite = await db.workspaceInvite.findUnique({ where: { token } });
  if (!invite) return null;
  if (invite.acceptedAt) return null;
  if (invite.expiresAt < new Date()) return null;
  if (invite.email.toLowerCase() !== email.toLowerCase()) return null;
  return invite;
}

// Called once when a brand-new User row is created (see the createUser event in auth.ts).
// Re-derives the same workspace/role decision decideSignIn made (that function already
// allowed this sign-in through, so this just needs to figure out WHERE, not WHETHER) and
// consumes the invite for real, now that the User row is guaranteed to exist.
export async function ensureWorkspaceMembership(userId: string, email: string, inviteToken?: string | null) {
  const existing = await db.workspaceMember.findUnique({ where: { userId } });
  if (existing) return existing;

  if (inviteToken) {
    const invite = await findValidInvite(inviteToken, email);
    if (invite) {
      await db.workspaceInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
      return db.workspaceMember.create({ data: { workspaceId: invite.workspaceId, userId, role: invite.role } });
    }
  }

  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;

  const existingWorkspace = await db.workspace.findUnique({ where: { emailDomain: domain } });
  if (existingWorkspace) {
    // decideSignIn should have rejected this sign-in before the User row was ever created —
    // reaching here means a same-domain sign-up race (two people from the same new domain
    // signing up in the same instant). Don't hand out ownership of someone else's workspace;
    // leave this User without a WorkspaceMember row so requireWorkspace() blocks them, same
    // as if they'd been rejected outright.
    return null;
  }

  const workspace = await db.workspace.create({ data: { name: domain, emailDomain: domain } });
  return db.workspaceMember.create({ data: { workspaceId: workspace.id, userId, role: "owner" } });
}

export type WorkspaceContext = {
  userId: string;
  workspaceId: string;
  role: string;
};

// The single entry point every server action must call before touching workspace-scoped
// data — replaces the old "const session = await auth(); if (!session?.user?.id) throw"
// pattern repeated across src/lib/actions/*. Centralizing it here means workspace scoping
// can't be forgotten in a new action the way a per-file ownerId filter could be.
export async function requireWorkspace(): Promise<WorkspaceContext> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  if (!session.user.workspaceId) throw new Error("No workspace");

  // Checked here (not just at login) so a suspension takes effect immediately on a workspace's
  // existing sessions too, not just on the next sign-in — JWT sessions don't otherwise re-check
  // anything server-side between token refreshes.
  const workspace = await db.workspace.findUnique({ where: { id: session.user.workspaceId }, select: { suspendedAt: true } });
  if (workspace?.suspendedAt) throw new Error("This workspace has been suspended.");

  return {
    userId: session.user.id,
    workspaceId: session.user.workspaceId,
    role: session.user.role ?? "member",
  };
}

// For the rarer action that must restrict to the workspace owner (e.g. billing, deleting
// the workspace, changing the Google-domain allowlist) — throws the same way requireWorkspace
// does, so callers don't need a separate role check afterward.
export async function requireWorkspaceOwner(): Promise<WorkspaceContext> {
  const ctx = await requireWorkspace();
  if (ctx.role !== "owner") throw new Error("Owner access required");
  return ctx;
}

// For settings pages a workspace admin can reach too (email templates, playbooks, data
// model, pipeline, import) — owner is always allowed (superset), admin is the second tier,
// plain member is rejected. Distinct from requireWorkspaceOwner's stricter owner-only gate.
export async function requireWorkspaceAdmin(): Promise<WorkspaceContext> {
  const ctx = await requireWorkspace();
  if (ctx.role !== "owner" && ctx.role !== "admin") throw new Error("Admin access required");
  return ctx;
}

// onboardedAt isn't carried on the session (it would need a re-login/session refresh to
// reflect right after the user completes onboarding) — read fresh from the DB instead,
// same as the session() callback already does for workspaceId/role.
export async function hasCompletedOnboarding(userId: string) {
  const member = await db.workspaceMember.findUnique({ where: { userId }, select: { onboardedAt: true } });
  return !!member?.onboardedAt;
}

// A plain member only sees Person/Opportunity rows they own — owner/admin see everything in
// the workspace. Spread this into a Prisma `where` alongside the mandatory workspaceId filter,
// e.g. `db.person.findMany({ where: { workspaceId, ...personVisibilityFilter(ctx) } })`.
// Also excludes soft-deleted (trashed) rows for everyone — trash has its own page for owner/admin.
export function personVisibilityFilter(ctx: WorkspaceContext) {
  if (ctx.role === "owner" || ctx.role === "admin") return { deletedAt: null };
  return { deletedAt: null, ownerId: ctx.userId };
}

export function opportunityVisibilityFilter(ctx: WorkspaceContext) {
  if (ctx.role === "owner" || ctx.role === "admin") return { deletedAt: null };
  return { deletedAt: null, ownerId: ctx.userId };
}

// A member sees a Company only if they own at least one Person or Opportunity attached to
// it — owner/admin see every company in the workspace.
export function companyVisibilityFilter(ctx: WorkspaceContext) {
  if (ctx.role === "owner" || ctx.role === "admin") return { deletedAt: null };
  return {
    deletedAt: null,
    OR: [
      { people: { some: { ownerId: ctx.userId } } },
      { opportunities: { some: { ownerId: ctx.userId } } },
    ],
  };
}
