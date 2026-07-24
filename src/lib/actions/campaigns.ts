"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { assertLimit } from "@/lib/entitlements";
import { enrollCampaignMembers, backfillStepForExistingMembers } from "@/lib/campaign-runner";

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
        include: { person: { include: { company: true } }, variant: true },
        orderBy: { addedAt: "asc" },
      },
      mailboxes: {
        include: { mailboxAccount: true },
        orderBy: { addedAt: "asc" },
      },
      steps: {
        include: { bodies: true },
        orderBy: { order: "asc" },
      },
      variants: {
        orderBy: { order: "asc" },
      },
    },
  });
}

export async function createCampaign(name: string) {
  const { userId, workspaceId } = await requireWorkspace();
  await assertLimit(workspaceId, "campaigns_count");

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

// A person is off-limits for a new bulk send if they're already being worked by an
// in-progress Sequence — campaign-to-campaign membership is not exclusive, a person can be
// enrolled in multiple campaigns at once.
async function findUnavailablePersonIds(workspaceId: string): Promise<Set<string>> {
  const sequenceEnrollments = await db.sequenceEnrollment.findMany({
    where: { workspaceId, status: "active" },
    select: { personId: true },
  });
  return new Set(sequenceEnrollments.map((e) => e.personId));
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

// Reactive enrollment: if the campaign has already been started at least once (not
// "draft"), a newly-added member gets its CampaignStepRuns scheduled immediately instead
// of waiting for a manual restart — see enrollCampaignMember in campaign-runner.ts.
async function reactivelyEnroll(campaignId: string, workspaceId: string, memberIds: string[]) {
  const campaign = await db.campaign.findUniqueOrThrow({ where: { id: campaignId, workspaceId }, select: { status: true } });
  if (campaign.status === "draft") return;
  await enrollCampaignMembers(memberIds, workspaceId);
}

export async function addContactToCampaign(campaignId: string, personId: string) {
  const { userId, workspaceId } = await requireWorkspace();

  const member = await db.campaignMember.upsert({
    where: { campaignId_personId: { campaignId, personId } },
    create: { workspaceId, campaignId, personId, addedById: userId },
    update: {},
  });
  await reactivelyEnroll(campaignId, workspaceId, [member.id]);
  revalidatePath(`/marketing/campaigns/${campaignId}`);
}

export async function addDealToCampaign(campaignId: string, opportunityId: string, personId: string) {
  const { userId, workspaceId } = await requireWorkspace();

  const member = await db.campaignMember.upsert({
    where: { campaignId_personId: { campaignId, personId } },
    create: { workspaceId, campaignId, personId, viaOpportunityId: opportunityId, addedById: userId },
    update: {},
  });
  await reactivelyEnroll(campaignId, workspaceId, [member.id]);
  revalidatePath(`/marketing/campaigns/${campaignId}`);
}

export async function addManyContactsToCampaign(campaignId: string, personIds: string[]) {
  const { userId, workspaceId } = await requireWorkspace();

  await db.campaignMember.createMany({
    data: personIds.map((personId) => ({ workspaceId, campaignId, personId, addedById: userId })),
    skipDuplicates: true,
  });
  const members = await db.campaignMember.findMany({ where: { workspaceId, campaignId, personId: { in: personIds } }, select: { id: true } });
  await reactivelyEnroll(campaignId, workspaceId, members.map((m) => m.id));
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
  const members = await db.campaignMember.findMany({
    where: { workspaceId, campaignId, personId: { in: deals.map((d) => d.personId) } },
    select: { id: true },
  });
  await reactivelyEnroll(campaignId, workspaceId, members.map((m) => m.id));
  revalidatePath(`/marketing/campaigns/${campaignId}`);
}

export type CampaignListOption = {
  id: string;
  name: string;
  entityType: "person" | "opportunity";
  count: number;
};

// Only person/opportunity lists can seed a campaign — company lists have no direct
// recipient email, so they're left out rather than guessing at a "primary contact".
export async function listAttachableListsForCampaign(): Promise<CampaignListOption[]> {
  const { workspaceId } = await requireWorkspace();
  const lists = await db.list.findMany({
    where: { workspaceId, entityType: { in: ["person", "opportunity"] } },
    include: { _count: { select: { items: true } } },
    orderBy: { name: "asc" },
  });
  return lists.map((l) => ({
    id: l.id,
    name: l.name,
    entityType: l.entityType as "person" | "opportunity",
    count: l._count.items,
  }));
}

// Adds every member of a list to the campaign in one shot. Person lists map straight to
// contacts; opportunity lists resolve to each deal's linked contact (deals with no contact
// are skipped, same as searchDealsForCampaign already does for manual add).
export async function addListToCampaign(campaignId: string, listId: string) {
  const { workspaceId } = await requireWorkspace();
  const [list, unavailable] = await Promise.all([
    db.list.findUniqueOrThrow({ where: { id: listId, workspaceId }, include: { items: true } }),
    findUnavailablePersonIds(workspaceId),
  ]);
  const entityIds = list.items.map((i) => i.entityId);

  if (list.entityType === "person") {
    await addManyContactsToCampaign(campaignId, entityIds.filter((id) => !unavailable.has(id)));
  } else if (list.entityType === "opportunity") {
    const deals = await db.opportunity.findMany({
      where: { workspaceId, id: { in: entityIds }, contactId: { not: null } },
      select: { id: true, contactId: true },
    });
    await addManyDealsToCampaign(
      campaignId,
      deals.filter((d) => !unavailable.has(d.contactId!)).map((d) => ({ opportunityId: d.id, personId: d.contactId! }))
    );
  } else {
    throw new Error("Only person or deal lists can be attached to a campaign.");
  }
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

// ---- Variants (A/N test arms) ----

export async function listCampaignVariants(campaignId: string) {
  const { workspaceId } = await requireWorkspace();
  return db.campaignVariant.findMany({ where: { workspaceId, campaignId }, orderBy: { order: "asc" } });
}

export async function addCampaignVariant(campaignId: string, name: string) {
  const { workspaceId } = await requireWorkspace();
  await assertLimit(workspaceId, "campaign_variants_count");

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");

  const last = await db.campaignVariant.findFirst({
    where: { workspaceId, campaignId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const variant = await db.campaignVariant.create({
    data: { workspaceId, campaignId, name: trimmed, order: (last?.order ?? -1) + 1 },
  });

  // Keep the step x variant grid fully populated: every existing step gets an empty body
  // row for the new variant, so setCampaignStepBody always has a row to upsert against.
  const steps = await db.campaignStep.findMany({ where: { workspaceId, campaignId }, select: { id: true } });
  if (steps.length > 0) {
    await db.campaignStepBody.createMany({
      data: steps.map((s) => ({ workspaceId, stepId: s.id, variantId: variant.id })),
    });
  }

  revalidatePath(`/marketing/campaigns/${campaignId}`);
  return variant;
}

export async function renameCampaignVariant(variantId: string, name: string) {
  const { workspaceId } = await requireWorkspace();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");

  const variant = await db.campaignVariant.update({ where: { id: variantId, workspaceId }, data: { name: trimmed } });
  revalidatePath(`/marketing/campaigns/${variant.campaignId}`);
}

export async function deleteCampaignVariant(variantId: string) {
  const { workspaceId } = await requireWorkspace();
  const variant = await db.campaignVariant.findUniqueOrThrow({ where: { id: variantId, workspaceId } });

  const memberCount = await db.campaignMember.count({ where: { workspaceId, variantId } });
  if (memberCount > 0) {
    throw new Error("Can't remove a variant members are already assigned to.");
  }

  await db.campaignVariant.delete({ where: { id: variantId, workspaceId } });
  revalidatePath(`/marketing/campaigns/${variant.campaignId}`);
}

// ---- Steps (timed sends) ----

export type CampaignStepInput = { delayDays: number; delayHours: number };

export async function listCampaignSteps(campaignId: string) {
  const { workspaceId } = await requireWorkspace();
  return db.campaignStep.findMany({
    where: { workspaceId, campaignId },
    include: { bodies: true },
    orderBy: { order: "asc" },
  });
}

export async function addCampaignStep(campaignId: string, input: CampaignStepInput) {
  const { workspaceId } = await requireWorkspace();
  await assertLimit(workspaceId, "campaign_steps_count");

  const [last, variants] = await Promise.all([
    db.campaignStep.findFirst({ where: { workspaceId, campaignId }, orderBy: { order: "desc" }, select: { order: true } }),
    db.campaignVariant.findMany({ where: { workspaceId, campaignId }, select: { id: true } }),
  ]);

  const step = await db.campaignStep.create({
    data: {
      workspaceId,
      campaignId,
      order: (last?.order ?? -1) + 1,
      delayDays: input.delayDays,
      delayHours: input.delayHours,
    },
  });

  // Mirror addCampaignVariant's grid-population: a new step gets one empty body row per
  // already-existing variant, so the grid is always fully populated in both directions.
  if (variants.length > 0) {
    await db.campaignStepBody.createMany({
      data: variants.map((v) => ({ workspaceId, stepId: step.id, variantId: v.id })),
    });
  }

  // A step added to a campaign that's already running backfills existing members too,
  // skipping anyone who already replied — see backfillStepForExistingMembers for the exact
  // rule. On a still-draft campaign this is a no-op (no member has enrolledAt set yet).
  await backfillStepForExistingMembers(step.id, campaignId, workspaceId);

  revalidatePath(`/marketing/campaigns/${campaignId}`);
  return step;
}

export async function deleteCampaignStep(stepId: string) {
  const { workspaceId } = await requireWorkspace();
  const step = await db.campaignStep.findUniqueOrThrow({ where: { id: stepId, workspaceId } });

  const sentCount = await db.campaignStepRun.count({
    where: { workspaceId, stepId, status: { in: ["sent", "failed"] } },
  });
  if (sentCount > 0) {
    throw new Error("Can't remove a step that's already been sent to some recipients.");
  }

  await db.campaignStep.delete({ where: { id: stepId, workspaceId } });
  revalidatePath(`/marketing/campaigns/${step.campaignId}`);
}

export async function reorderCampaignSteps(campaignId: string, orderedIds: string[]) {
  const { workspaceId } = await requireWorkspace();
  await Promise.all(orderedIds.map((id, i) => db.campaignStep.update({ where: { id, workspaceId }, data: { order: i } })));
  revalidatePath(`/marketing/campaigns/${campaignId}`);
}

// ---- Step bodies (per step x variant content) ----

export type CampaignStepBodyInput = { templateId?: string | null; subject?: string; bodyHtml?: string };

export async function setCampaignStepBody(stepId: string, variantId: string, input: CampaignStepBodyInput) {
  const { workspaceId } = await requireWorkspace();
  const step = await db.campaignStep.findUniqueOrThrow({ where: { id: stepId, workspaceId } });

  await db.campaignStepBody.upsert({
    where: { stepId_variantId: { stepId, variantId } },
    create: {
      workspaceId,
      stepId,
      variantId,
      templateId: input.templateId || null,
      subject: input.subject,
      bodyHtml: input.bodyHtml,
    },
    update: {
      templateId: input.templateId || null,
      subject: input.subject,
      bodyHtml: input.bodyHtml,
    },
  });
  revalidatePath(`/marketing/campaigns/${step.campaignId}`);
}

// Renders a step/variant's subject/body with a real recipient's data so the builder can
// show what the merge tokens will actually produce — falls back to raw content if the
// campaign has no members yet (nothing to interpolate against).
export async function previewCampaignStepBody(stepId: string, variantId: string) {
  const { workspaceId } = await requireWorkspace();
  const body = await db.campaignStepBody.findUniqueOrThrow({
    where: { stepId_variantId: { stepId, variantId } },
    include: { template: true, step: true },
  });
  const firstMember = await db.campaignMember.findFirst({
    where: { workspaceId, campaignId: body.step.campaignId },
    orderBy: { addedAt: "asc" },
  });

  const rawSubject = body.templateId ? body.template!.subject : body.subject ?? "";
  const rawBodyHtml = body.templateId ? body.template!.bodyHtml : body.bodyHtml ?? "";

  if (!firstMember) {
    return { subject: rawSubject, bodyHtml: rawBodyHtml, previewedFor: null as string | null };
  }

  const { interpolateForPerson } = await import("@/lib/template-variables");
  const [subject, bodyHtml] = await Promise.all([
    interpolateForPerson(rawSubject, firstMember.personId, workspaceId),
    interpolateForPerson(rawBodyHtml, firstMember.personId, workspaceId),
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
  stepCount: number;
  variantCount: number;
};

export async function getCampaignReadiness(campaignId: string): Promise<CampaignReadiness> {
  const { workspaceId } = await requireWorkspace();
  const campaign = await db.campaign.findUniqueOrThrow({
    where: { id: campaignId, workspaceId },
    include: { members: true, mailboxes: true, steps: true, variants: true },
  });

  const base = {
    recipientCount: campaign.members.length,
    mailboxCount: campaign.mailboxes.length,
    stepCount: campaign.steps.length,
    variantCount: campaign.variants.length,
  };

  if (campaign.members.length === 0) {
    return { ready: false, reason: "Add at least one recipient first.", ...base };
  }
  if (campaign.mailboxes.length === 0) {
    return { ready: false, reason: "Select at least one outreach inbox first.", ...base };
  }
  if (campaign.variants.length === 0) {
    return { ready: false, reason: "Add at least one template variant first.", ...base };
  }
  if (campaign.steps.length === 0) {
    return { ready: false, reason: "Add at least one step first.", ...base };
  }

  return { ready: true, reason: null, ...base };
}

// Enrolls every not-yet-enrolled member, staggering step-1 sends 30-60s apart within the
// batch (see enrollCampaignMembers in campaign-runner.ts) so it trickles out over time
// instead of firing all at once. The repeatable campaign-worker tick picks up the
// resulting CampaignStepRuns as they come due.
export async function startCampaign(campaignId: string) {
  const { workspaceId } = await requireWorkspace();
  await assertLimit(workspaceId, "campaigns_feature");

  const campaign = await db.campaign.findUniqueOrThrow({
    where: { id: campaignId, workspaceId },
    include: {
      members: { where: { enrolledAt: null } },
      mailboxes: true,
      steps: true,
      variants: true,
    },
  });

  if (campaign.mailboxes.length === 0) throw new Error("Select at least one outreach inbox first.");
  if (campaign.steps.length === 0) throw new Error("Add at least one step first.");
  if (campaign.variants.length === 0) throw new Error("Add at least one template variant first.");
  if (campaign.members.length === 0) throw new Error("No pending recipients to send to.");

  await enrollCampaignMembers(campaign.members.map((m) => m.id), workspaceId);
  revalidatePath(`/marketing/campaigns/${campaignId}`);
}

export type CampaignProgressMember = {
  id: string;
  personId: string;
  name: string;
  email: string | null;
  variantName: string | null;
  currentStep: { order: number; total: number } | null; // null once every step is terminal
  opened: boolean;
  openedAt: Date | null;
};

export type CampaignProgressStep = {
  stepId: string;
  order: number;
  delayLabel: string;
  pending: number;
  sent: number;
  failed: number;
  skipped: number;
};

export type CampaignProgressVariant = {
  variantId: string;
  name: string;
  memberCount: number;
  sent: number;
  opened: number;
};

export type CampaignProgress = {
  total: number;
  enrolled: number;
  opened: number;
  bySteps: CampaignProgressStep[];
  byVariant: CampaignProgressVariant[];
  members: CampaignProgressMember[];
};

function delayLabel(delayDays: number, delayHours: number) {
  if (delayDays === 0 && delayHours === 0) return "Immediately";
  const parts = [];
  if (delayDays > 0) parts.push(`${delayDays}d`);
  if (delayHours > 0) parts.push(`${delayHours}h`);
  return `+${parts.join(" ")}`;
}

export async function getCampaignProgress(campaignId: string): Promise<CampaignProgress> {
  const { workspaceId } = await requireWorkspace();

  const [steps, variants, members] = await Promise.all([
    db.campaignStep.findMany({ where: { workspaceId, campaignId }, orderBy: { order: "asc" } }),
    db.campaignVariant.findMany({ where: { workspaceId, campaignId }, orderBy: { order: "asc" } }),
    db.campaignMember.findMany({
      where: { workspaceId, campaignId },
      include: {
        person: true,
        variant: true,
        runs: { include: { step: true }, orderBy: { step: { order: "asc" } } },
        emails: { include: { opens: { orderBy: { openedAt: "asc" }, take: 1 } } },
      },
      orderBy: [{ enrolledAt: "desc" }, { addedAt: "asc" }],
    }),
  ]);

  const bySteps: CampaignProgressStep[] = steps.map((step) => {
    const runs = members.flatMap((m) => m.runs).filter((r) => r.stepId === step.id);
    return {
      stepId: step.id,
      order: step.order,
      delayLabel: delayLabel(step.delayDays, step.delayHours),
      pending: runs.filter((r) => r.status === "pending").length,
      sent: runs.filter((r) => r.status === "sent").length,
      failed: runs.filter((r) => r.status === "failed").length,
      skipped: runs.filter((r) => r.status === "skipped").length,
    };
  });

  const byVariant: CampaignProgressVariant[] = variants.map((variant) => {
    const variantMembers = members.filter((m) => m.variantId === variant.id);
    const sent = variantMembers.reduce((sum, m) => sum + m.runs.filter((r) => r.status === "sent").length, 0);
    const opened = variantMembers.filter((m) => m.emails.some((e) => e.opens.length > 0)).length;
    return { variantId: variant.id, name: variant.name, memberCount: variantMembers.length, sent, opened };
  });

  let opened = 0;
  let enrolled = 0;
  const memberRows: CampaignProgressMember[] = members.map((m) => {
    if (m.enrolledAt) enrolled++;
    const firstOpen = m.emails.flatMap((e) => e.opens)[0] ?? null;
    if (firstOpen) opened++;

    const nextPending = m.runs.find((r) => r.status === "pending");
    const currentStep = nextPending ? { order: nextPending.step.order + 1, total: steps.length } : null;

    return {
      id: m.id,
      personId: m.personId,
      name: [m.person.firstName, m.person.lastName].filter(Boolean).join(" ") || "Untitled",
      email: m.person.email,
      variantName: m.variant?.name ?? null,
      currentStep,
      opened: !!firstOpen,
      openedAt: firstOpen?.openedAt ?? null,
    };
  });

  return { total: members.length, enrolled, opened, bySteps, byVariant, members: memberRows };
}
