"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { campaignQueue } from "@/lib/campaign-queue";

// Random pace between sends so a bulk campaign doesn't look/behave like a mail blast.
const MIN_SEND_GAP_MS = 30_000;
const MAX_SEND_GAP_MS = 60_000;

export async function listCampaigns() {
  const { workspaceId } = await requireWorkspace();
  return db.campaign.findMany({
    where: { workspaceId },
    include: { createdBy: true, _count: { select: { members: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCampaign(id: string) {
  const { workspaceId } = await requireWorkspace();
  return db.campaign.findUnique({
    where: { id, workspaceId },
    include: {
      members: {
        include: { person: { include: { company: true } } },
        orderBy: { addedAt: "asc" },
      },
      mailboxes: {
        include: { mailboxAccount: true },
        orderBy: { addedAt: "asc" },
      },
      template: true,
    },
  });
}

export async function createCampaign(name: string) {
  const { userId, workspaceId } = await requireWorkspace();

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");

  const campaign = await db.campaign.create({
    data: { workspaceId, name: trimmed, createdById: userId },
  });
  revalidatePath("/marketing/campaigns");
  return campaign;
}

export async function deleteCampaign(id: string) {
  const { workspaceId } = await requireWorkspace();

  await db.campaign.delete({ where: { id, workspaceId } });
  revalidatePath("/marketing/campaigns");
}

// A person is off-limits for a new bulk send if they're already being worked by any
// active flow — an in-progress Sequence, or membership in another non-draft Campaign.
async function findUnavailablePersonIds(workspaceId: string): Promise<Set<string>> {
  const [sequenceEnrollments, campaignMembers] = await Promise.all([
    db.sequenceEnrollment.findMany({
      where: { workspaceId, status: "active" },
      select: { personId: true },
    }),
    db.campaignMember.findMany({
      where: { workspaceId, campaign: { status: { in: ["active", "sent"] } } },
      select: { personId: true },
    }),
  ]);

  return new Set([
    ...sequenceEnrollments.map((e) => e.personId),
    ...campaignMembers.map((m) => m.personId),
  ]);
}

export type CampaignPersonRow = {
  id: string;
  name: string;
  subtitle: string | null;
  alreadyInCampaign: boolean;
  unavailable: boolean;
};

export async function searchContactsForCampaign(campaignId: string, query: string): Promise<CampaignPersonRow[]> {
  const { workspaceId } = await requireWorkspace();
  const [campaign, unavailable] = await Promise.all([
    db.campaign.findUniqueOrThrow({ where: { id: campaignId, workspaceId }, include: { members: true } }),
    findUnavailablePersonIds(workspaceId),
  ]);
  const inCampaignIds = new Set(campaign.members.map((m) => m.personId));

  const q = query.trim();
  const people = await db.person.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { company: true },
    orderBy: { firstName: "asc" },
    take: 30,
  });

  return people.map((p) => ({
    id: p.id,
    name: [p.firstName, p.lastName].filter(Boolean).join(" ") || "Untitled",
    subtitle: [p.email, p.company?.name].filter(Boolean).join(" · ") || null,
    alreadyInCampaign: inCampaignIds.has(p.id),
    unavailable: !inCampaignIds.has(p.id) && unavailable.has(p.id),
  }));
}

export type CampaignDealRow = {
  id: string;
  name: string;
  subtitle: string | null;
  contactId: string;
  alreadyInCampaign: boolean;
  unavailable: boolean;
};

export async function searchDealsForCampaign(campaignId: string, query: string): Promise<CampaignDealRow[]> {
  const { workspaceId } = await requireWorkspace();
  const [campaign, unavailable] = await Promise.all([
    db.campaign.findUniqueOrThrow({ where: { id: campaignId, workspaceId }, include: { members: true } }),
    findUnavailablePersonIds(workspaceId),
  ]);
  const inCampaignIds = new Set(campaign.members.map((m) => m.personId));

  const q = query.trim();
  const deals = await db.opportunity.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      contactId: { not: null },
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    include: { contact: true, company: true },
    orderBy: { name: "asc" },
    take: 30,
  });

  return deals
    .filter((d) => d.contact)
    .map((d) => ({
      id: d.id,
      name: d.name,
      subtitle: [d.contact!.firstName + (d.contact!.lastName ? ` ${d.contact!.lastName}` : ""), d.company?.name]
        .filter(Boolean)
        .join(" · ") || null,
      contactId: d.contactId!,
      alreadyInCampaign: inCampaignIds.has(d.contactId!),
      unavailable: !inCampaignIds.has(d.contactId!) && unavailable.has(d.contactId!),
    }));
}

export async function addContactToCampaign(campaignId: string, personId: string) {
  const { userId, workspaceId } = await requireWorkspace();

  await db.campaignMember.upsert({
    where: { campaignId_personId: { campaignId, personId } },
    create: { workspaceId, campaignId, personId, addedById: userId },
    update: {},
  });
  revalidatePath(`/marketing/campaigns/${campaignId}`);
}

export async function addDealToCampaign(campaignId: string, opportunityId: string, personId: string) {
  const { userId, workspaceId } = await requireWorkspace();

  await db.campaignMember.upsert({
    where: { campaignId_personId: { campaignId, personId } },
    create: { workspaceId, campaignId, personId, viaOpportunityId: opportunityId, addedById: userId },
    update: {},
  });
  revalidatePath(`/marketing/campaigns/${campaignId}`);
}

export async function addManyContactsToCampaign(campaignId: string, personIds: string[]) {
  const { userId, workspaceId } = await requireWorkspace();

  await db.campaignMember.createMany({
    data: personIds.map((personId) => ({ workspaceId, campaignId, personId, addedById: userId })),
    skipDuplicates: true,
  });
  revalidatePath(`/marketing/campaigns/${campaignId}`);
}

export async function addManyDealsToCampaign(
  campaignId: string,
  deals: { opportunityId: string; personId: string }[]
) {
  const { userId, workspaceId } = await requireWorkspace();

  await db.campaignMember.createMany({
    data: deals.map(({ opportunityId, personId }) => ({
      workspaceId,
      campaignId,
      personId,
      viaOpportunityId: opportunityId,
      addedById: userId,
    })),
    skipDuplicates: true,
  });
  revalidatePath(`/marketing/campaigns/${campaignId}`);
}

export async function removeMemberFromCampaign(campaignId: string, personId: string) {
  const { workspaceId } = await requireWorkspace();

  await db.campaignMember.deleteMany({ where: { workspaceId, campaignId, personId } });
  revalidatePath(`/marketing/campaigns/${campaignId}`);
}

export async function getActiveMailboxAccountsForCampaign(campaignId: string) {
  const { workspaceId } = await requireWorkspace();
  const [accounts, campaign] = await Promise.all([
    db.mailboxAccount.findMany({ where: { workspaceId, active: true }, orderBy: { label: "asc" } }),
    db.campaign.findUniqueOrThrow({ where: { id: campaignId, workspaceId }, include: { mailboxes: true } }),
  ]);
  const selectedIds = new Set(campaign.mailboxes.map((m) => m.mailboxAccountId));

  return accounts.map((a) => ({
    id: a.id,
    label: a.label,
    email: a.email,
    smtpStatus: a.smtpStatus,
    selected: selectedIds.has(a.id),
  }));
}

export async function setCampaignMailboxes(campaignId: string, mailboxAccountIds: string[]) {
  const { workspaceId } = await requireWorkspace();

  await db.$transaction([
    db.campaignMailbox.deleteMany({ where: { workspaceId, campaignId } }),
    db.campaignMailbox.createMany({
      data: mailboxAccountIds.map((mailboxAccountId) => ({ workspaceId, campaignId, mailboxAccountId })),
    }),
  ]);
  revalidatePath(`/marketing/campaigns/${campaignId}`);
}

export type CampaignTemplateOption = {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  selected: boolean;
};

export async function listEmailTemplatesForCampaign(campaignId: string): Promise<CampaignTemplateOption[]> {
  const { workspaceId } = await requireWorkspace();
  const [templates, campaign] = await Promise.all([
    db.emailTemplate.findMany({ where: { workspaceId }, orderBy: { name: "asc" } }),
    db.campaign.findUniqueOrThrow({ where: { id: campaignId, workspaceId } }),
  ]);

  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    subject: t.subject,
    bodyHtml: t.bodyHtml,
    selected: t.id === campaign.templateId,
  }));
}

export async function setCampaignTemplate(campaignId: string, templateId: string | null) {
  const { workspaceId } = await requireWorkspace();

  await db.campaign.update({ where: { id: campaignId, workspaceId }, data: { templateId } });
  revalidatePath(`/marketing/campaigns/${campaignId}`);
}

// Renders a template's subject/body with a real recipient's data so the builder can show
// what the merge tokens will actually produce — falls back to the raw template if the
// campaign has no members yet (nothing to interpolate against).
export async function previewCampaignTemplate(campaignId: string, templateId: string) {
  const { workspaceId } = await requireWorkspace();
  const [template, firstMember] = await Promise.all([
    db.emailTemplate.findUniqueOrThrow({ where: { id: templateId, workspaceId } }),
    db.campaignMember.findFirst({ where: { workspaceId, campaignId }, orderBy: { addedAt: "asc" } }),
  ]);

  if (!firstMember) {
    return { subject: template.subject, bodyHtml: template.bodyHtml, previewedFor: null as string | null };
  }

  const { interpolateForPerson } = await import("@/lib/template-variables");
  const [subject, bodyHtml] = await Promise.all([
    interpolateForPerson(template.subject, firstMember.personId, workspaceId),
    interpolateForPerson(template.bodyHtml, firstMember.personId, workspaceId),
  ]);
  const person = await db.person.findUnique({ where: { id: firstMember.personId, workspaceId } });
  const previewedFor = person ? [person.firstName, person.lastName].filter(Boolean).join(" ") : null;

  return { subject, bodyHtml, previewedFor };
}

export type CampaignReadiness = {
  ready: boolean;
  reason: string | null;
  recipientCount: number;
  mailboxCount: number;
  templateName: string | null;
};

export async function getCampaignReadiness(campaignId: string): Promise<CampaignReadiness> {
  const { workspaceId } = await requireWorkspace();
  const campaign = await db.campaign.findUniqueOrThrow({
    where: { id: campaignId, workspaceId },
    include: { members: true, mailboxes: true, template: true },
  });

  if (campaign.members.length === 0) {
    return { ready: false, reason: "Add at least one recipient first.", recipientCount: 0, mailboxCount: campaign.mailboxes.length, templateName: campaign.template?.name ?? null };
  }
  if (campaign.mailboxes.length === 0) {
    return { ready: false, reason: "Select at least one outreach inbox first.", recipientCount: campaign.members.length, mailboxCount: 0, templateName: campaign.template?.name ?? null };
  }
  if (!campaign.template) {
    return { ready: false, reason: "Select an email template first.", recipientCount: campaign.members.length, mailboxCount: campaign.mailboxes.length, templateName: null };
  }

  return {
    ready: true,
    reason: null,
    recipientCount: campaign.members.length,
    mailboxCount: campaign.mailboxes.length,
    templateName: campaign.template.name,
  };
}

// Enqueues one paced send job per pending recipient, round-robining across the campaign's
// selected mailboxes, each job delayed 30-60s after the previous one so the whole batch
// trickles out over time instead of firing all at once.
export async function startCampaign(campaignId: string) {
  const { workspaceId } = await requireWorkspace();

  const campaign = await db.campaign.findUniqueOrThrow({
    where: { id: campaignId, workspaceId },
    include: {
      members: { where: { sendStatus: "pending" } },
      mailboxes: true,
    },
  });

  if (campaign.mailboxes.length === 0) throw new Error("Select at least one outreach inbox first.");
  if (!campaign.templateId) throw new Error("Select an email template first.");
  if (campaign.members.length === 0) throw new Error("No pending recipients to send to.");

  let cumulativeDelay = 0;
  for (let i = 0; i < campaign.members.length; i++) {
    const member = campaign.members[i];
    const mailboxAccountId = campaign.mailboxes[i % campaign.mailboxes.length].mailboxAccountId;

    if (i > 0) cumulativeDelay += MIN_SEND_GAP_MS + Math.random() * (MAX_SEND_GAP_MS - MIN_SEND_GAP_MS);

    await campaignQueue.add(
      "send",
      { campaignMemberId: member.id, mailboxAccountId },
      { delay: Math.round(cumulativeDelay) }
    );
    await db.campaignMember.update({ where: { id: member.id, workspaceId }, data: { sendStatus: "queued" } });
  }

  await db.campaign.update({ where: { id: campaignId, workspaceId }, data: { status: "active" } });
  revalidatePath(`/marketing/campaigns/${campaignId}`);
}

export type CampaignProgressMember = {
  id: string;
  personId: string;
  name: string;
  email: string | null;
  sendStatus: string;
  sentAt: Date | null;
  sendError: string | null;
  opened: boolean;
  openedAt: Date | null;
};

export type CampaignProgress = {
  total: number;
  pending: number;
  queued: number;
  sent: number;
  failed: number;
  opened: number;
  members: CampaignProgressMember[];
};

export async function getCampaignProgress(campaignId: string): Promise<CampaignProgress> {
  const { workspaceId } = await requireWorkspace();
  const members = await db.campaignMember.findMany({
    where: { workspaceId, campaignId },
    include: {
      person: true,
      emails: {
        include: { opens: { orderBy: { openedAt: "asc" }, take: 1 } },
      },
    },
    // Most-recently-resolved first (sent/failed), so the top of the list shows what just
    // happened rather than the untouched tail of the queue.
    orderBy: [{ sentAt: "desc" }, { addedAt: "asc" }],
  });

  const counts = { pending: 0, queued: 0, sent: 0, failed: 0 };
  let opened = 0;
  for (const m of members) {
    counts[m.sendStatus as keyof typeof counts]++;
    if (m.emails.some((e) => e.opens.length > 0)) opened++;
  }

  return {
    total: members.length,
    ...counts,
    opened,
    members: members.map((m) => {
      const firstOpen = m.emails.flatMap((e) => e.opens)[0] ?? null;
      return {
        id: m.id,
        personId: m.personId,
        name: [m.person.firstName, m.person.lastName].filter(Boolean).join(" ") || "Untitled",
        email: m.person.email,
        sendStatus: m.sendStatus,
        sentAt: m.sentAt,
        sendError: m.sendError,
        opened: !!firstOpen,
        openedAt: firstOpen?.openedAt ?? null,
      };
    }),
  };
}
