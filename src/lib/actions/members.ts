"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireWorkspace, requireWorkspaceOwner } from "@/lib/workspace";
import { db } from "@/lib/db";
import { sendFromNotificationInbox } from "@/lib/notification-inbox-send";
import { getTrackingBaseUrl } from "@/lib/workspace-settings";
import { assertLimit } from "@/lib/entitlements";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function listMembers() {
  const { workspaceId } = await requireWorkspace();
  const members = await db.workspaceMember.findMany({
    where: { workspaceId },
    orderBy: { id: "asc" },
    select: { id: true, role: true, user: { select: { id: true, name: true, email: true, image: true } } },
  });
  return members.map((m) => ({ ...m.user, role: m.role, memberId: m.id }));
}

export async function listPendingInvites() {
  const { workspaceId } = await requireWorkspace();
  return db.workspaceInvite.findMany({
    where: { workspaceId, acceptedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, createdAt: true, expiresAt: true },
  });
}

export type WorkspaceRole = "owner" | "admin" | "member";
export type InviteMemberInput = { email: string; role?: WorkspaceRole };

// Owner-only: creates a WorkspaceInvite and emails the recipient a one-time sign-in link.
// Deliberately does NOT create a User row directly (the old createMember behavior) — a new
// teammate must go through the invite-token sign-in flow in auth.ts so they land in THIS
// workspace, not accidentally create/join the wrong one.
export async function inviteMember(input: InviteMemberInput) {
  const { userId, workspaceId } = await requireWorkspaceOwner();
  await assertLimit(workspaceId, "members_count");

  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("Email is required");

  const existingUser = await db.user.findUnique({ where: { email }, include: { workspaceMember: true } });
  if (existingUser?.workspaceMember) {
    throw new Error(
      existingUser.workspaceMember.workspaceId === workspaceId
        ? "This person is already a member of this workspace."
        : "This person already belongs to another workspace."
    );
  }

  const token = randomBytes(32).toString("hex");
  await db.workspaceInvite.create({
    data: {
      email,
      role: input.role ?? "member",
      token,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      workspaceId,
      invitedById: userId,
    },
  });

  const baseUrl = await getTrackingBaseUrl();
  const inviteUrl = `${baseUrl}/invite/${token}`;
  await sendFromNotificationInbox(
    email,
    "You've been invited to join a workspace",
    `<p>You've been invited to join a CRM workspace.</p><p><a href="${inviteUrl}">${inviteUrl}</a></p><p>This invite expires in 7 days.</p>`,
    workspaceId
  );

  revalidatePath("/settings/members");
}

export async function revokeInvite(inviteId: string) {
  const { workspaceId } = await requireWorkspaceOwner();
  await db.workspaceInvite.deleteMany({ where: { id: inviteId, workspaceId } });
  revalidatePath("/settings/members");
}

// Owner-only: changes another member's role. Refuses to demote the workspace's last
// remaining owner — leaving a workspace with zero owners would lock everyone out of
// owner-only pages (billing, this one, the Google-domain allowlist) with no way back in.
export async function updateMemberRole(memberId: string, role: WorkspaceRole) {
  const { workspaceId } = await requireWorkspaceOwner();

  const member = await db.workspaceMember.findUniqueOrThrow({ where: { id: memberId, workspaceId } });
  if (member.role === "owner" && role !== "owner") {
    const ownerCount = await db.workspaceMember.count({ where: { workspaceId, role: "owner" } });
    if (ownerCount <= 1) throw new Error("A workspace needs at least one owner.");
  }

  await db.workspaceMember.update({ where: { id: memberId }, data: { role } });
  revalidatePath("/settings/members");
}
