"use server";

import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";

export type CampaignSummary = {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  memberCount: number;
  sentCount: number;
  failedCount: number;
  openedCount: number; // members with at least one open on their campaign email
  openRatePct: number | null; // null when nothing's sent yet — no denominator to rate against
};

export async function listCampaignPerformance(): Promise<CampaignSummary[]> {
  const { workspaceId } = await requireWorkspace();

  const campaigns = await db.campaign.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    include: {
      members: {
        select: {
          runs: { select: { status: true } },
          emails: { select: { opens: { select: { id: true }, take: 1 } } },
        },
      },
    },
  });

  return campaigns.map((c) => {
    // A member counts as "sent"/"failed" if any of their per-step runs resolved that way —
    // a multi-step campaign can have both (step 1 sent, step 2 failed); sent takes priority
    // for this summary rollup since it reflects real outbound reach either way.
    const sentCount = c.members.filter((m) => m.runs.some((r) => r.status === "sent")).length;
    const failedCount = c.members.filter((m) => m.runs.length > 0 && m.runs.every((r) => r.status === "failed")).length;
    const openedCount = c.members.filter((m) => m.emails.some((e) => e.opens.length > 0)).length;
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      createdAt: c.createdAt,
      memberCount: c.members.length,
      sentCount,
      failedCount,
      openedCount,
      openRatePct: sentCount === 0 ? null : Math.round((openedCount / sentCount) * 100),
    };
  });
}

export type CampaignMemberRow = {
  id: string;
  personId: string;
  personName: string;
  sendStatus: string;
  opened: boolean;
  openCount: number;
};

export async function getCampaignMembers(campaignId: string, filter?: "opened" | "not-opened" | "failed"): Promise<CampaignMemberRow[]> {
  const { workspaceId } = await requireWorkspace();

  const members = await db.campaignMember.findMany({
    where: { workspaceId, campaignId },
    orderBy: { addedAt: "desc" },
    include: {
      person: { select: { firstName: true, lastName: true } },
      runs: { select: { status: true } },
      emails: { select: { opens: { select: { id: true } } } },
    },
  });

  const rows = members.map((m) => {
    const openCount = m.emails.reduce((sum, e) => sum + e.opens.length, 0);
    const sendStatus = m.runs.some((r) => r.status === "sent")
      ? "sent"
      : m.runs.length > 0 && m.runs.every((r) => r.status === "failed")
        ? "failed"
        : "pending";
    return {
      id: m.id,
      personId: m.personId,
      personName: [m.person.firstName, m.person.lastName].filter(Boolean).join(" ") || "Untitled",
      sendStatus,
      opened: openCount > 0,
      openCount,
    };
  });

  if (filter === "opened") return rows.filter((r) => r.opened);
  if (filter === "not-opened") return rows.filter((r) => r.sendStatus === "sent" && !r.opened);
  if (filter === "failed") return rows.filter((r) => r.sendStatus === "failed");
  return rows;
}
