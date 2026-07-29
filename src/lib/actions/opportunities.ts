"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace, opportunityVisibilityFilter } from "@/lib/workspace";
import { db } from "@/lib/db";
import { assertLimit } from "@/lib/entitlements";
import { sendOwnershipEmail } from "@/lib/ownership-notification";
import { OPPORTUNITY_FIELD_LABELS } from "@/lib/field-labels";
import { normalizeValue, normalizeProbability, resolveLostReason } from "@/lib/deal-fields";

export type OpportunityStage = string;
export type OpportunityField = keyof typeof OPPORTUNITY_FIELD_LABELS;

export type ConvertToOpportunityInput = {
  personId: string;
  name: string;
  stage: OpportunityStage;
  value: number;
};

export async function convertContactToOpportunity(input: ConvertToOpportunityInput) {
  const { userId, workspaceId } = await requireWorkspace();
  await assertLimit(workspaceId, "deals_count");

  const name = input.name.trim();
  if (!name) throw new Error("Deal name is required");

  const contact = await db.person.findUniqueOrThrow({ where: { id: input.personId, workspaceId } });

  const opportunity = await db.opportunity.create({
    data: {
      workspaceId,
      name,
      stage: input.stage,
      value: input.value,
      companyId: contact.companyId,
      contactId: contact.id,
      ownerId: userId,
      createdById: userId,
    },
  });

  await db.activity.create({
    data: {
      workspaceId,
      entityType: "opportunity",
      entityId: opportunity.id,
      kind: "created",
      actorId: userId,
    },
  });
  await db.activity.create({
    data: {
      workspaceId,
      entityType: "person",
      entityId: contact.id,
      kind: "opportunity_created",
      field: "Opportunity",
      newValue: name,
      actorId: userId,
    },
  });
  if (contact.companyId) {
    await db.activity.create({
      data: {
        workspaceId,
        entityType: "company",
        entityId: contact.companyId,
        kind: "opportunity_created",
        field: "Opportunity",
        newValue: name,
        actorId: userId,
      },
    });
  }

  revalidatePath(`/contacts/${contact.id}`);
  if (contact.companyId) revalidatePath(`/companies/${contact.companyId}`);

  return opportunity;
}

export type CreateOpportunityInput = {
  name: string;
  stage: OpportunityStage;
  value: number;
  contactId?: string | null;
  companyId?: string | null;
};

export async function createOpportunity(input: CreateOpportunityInput) {
  const { userId, workspaceId } = await requireWorkspace();
  await assertLimit(workspaceId, "deals_count");

  const name = input.name.trim();
  if (!name) throw new Error("Deal name is required");

  // A contact's own company wins if the deal is also linked to a contact — keeps
  // company/contact from disagreeing about who the deal is with.
  let companyId = input.companyId ?? null;
  if (input.contactId) {
    const contact = await db.person.findUniqueOrThrow({ where: { id: input.contactId, workspaceId } });
    companyId = contact.companyId;
  }

  const opportunity = await db.opportunity.create({
    data: {
      workspaceId,
      name,
      stage: input.stage,
      value: input.value,
      companyId,
      contactId: input.contactId ?? null,
      ownerId: userId,
      createdById: userId,
    },
  });

  await db.activity.create({
    data: { workspaceId, entityType: "opportunity", entityId: opportunity.id, kind: "created", actorId: userId },
  });
  if (input.contactId) {
    await db.activity.create({
      data: {
        workspaceId,
        entityType: "person",
        entityId: input.contactId,
        kind: "opportunity_created",
        field: "Opportunity",
        newValue: name,
        actorId: userId,
      },
    });
  }
  if (companyId) {
    await db.activity.create({
      data: {
        workspaceId,
        entityType: "company",
        entityId: companyId,
        kind: "opportunity_created",
        field: "Opportunity",
        newValue: name,
        actorId: userId,
      },
    });
  }

  revalidatePath("/deals");
  if (input.contactId) revalidatePath(`/contacts/${input.contactId}`);
  if (companyId) revalidatePath(`/companies/${companyId}`);

  return opportunity;
}

export async function listOpportunitiesForPerson(personId: string) {
  const ctx = await requireWorkspace();
  return db.opportunity.findMany({
    where: { workspaceId: ctx.workspaceId, contactId: personId, ...opportunityVisibilityFilter(ctx) },
    orderBy: { createdAt: "desc" },
  });
}

export async function listOpportunitiesForCompany(companyId: string) {
  const ctx = await requireWorkspace();
  return db.opportunity.findMany({
    where: { workspaceId: ctx.workspaceId, companyId, ...opportunityVisibilityFilter(ctx) },
    orderBy: { createdAt: "desc" },
  });
}

export async function listOpportunities() {
  const ctx = await requireWorkspace();
  const opportunities = await db.opportunity.findMany({
    where: { workspaceId: ctx.workspaceId, ...opportunityVisibilityFilter(ctx) },
    include: {
      company: true,
      contact: { include: { campaignMembers: { include: { campaign: true } } } },
      owner: true,
      createdBy: true,
    },
    orderBy: { createdAt: "desc" },
  });
  // A deal's "Campaigns" is its primary contact's full campaign involvement, flattened onto
  // the row — OpportunityRow doesn't nest it under contact since Kanban cards/list rows
  // render it independently of whether a contact pill is also shown.
  return opportunities.map(({ contact, ...o }) => ({
    ...o,
    contact,
    campaigns: contact?.campaignMembers.map((m) => m.campaign) ?? [],
  }));
}

export async function getOpportunity(id: string) {
  const ctx = await requireWorkspace();
  const opportunity = await db.opportunity.findUnique({
    where: { id, workspaceId: ctx.workspaceId, ...opportunityVisibilityFilter(ctx) },
    include: {
      company: true,
      contact: { include: { campaignMembers: { include: { campaign: true } } } },
      owner: true,
      createdBy: true,
    },
  });
  if (!opportunity) return null;
  const { contact, ...o } = opportunity;
  return { ...o, contact, campaigns: contact?.campaignMembers.map((m) => m.campaign) ?? [] };
}

export async function moveOpportunityStage(id: string, stage: OpportunityStage, lostReason?: string) {
  const { userId, workspaceId } = await requireWorkspace();

  const current = await db.opportunity.findUniqueOrThrow({ where: { id, workspaceId } });
  if (current.stage === stage) return;

  const target = await db.pipelineStage.findUnique({ where: { workspaceId_label: { workspaceId, label: stage } } });
  const isOpen = !target || target.outcome === "open";
  const closeDate = isOpen ? null : new Date();

  const reason = resolveLostReason(target?.outcome, lostReason, current.lostReason);

  await db.opportunity.update({ where: { id, workspaceId }, data: { stage, closeDate, lostReason: reason } });

  const activityData = {
    workspaceId,
    kind: "stage_changed",
    field: "Stage",
    oldValue: current.stage,
    newValue: stage,
    actorId: userId,
  };
  await db.activity.create({ data: { entityType: "opportunity", entityId: id, ...activityData } });
  if (current.contactId) {
    await db.activity.create({ data: { entityType: "person", entityId: current.contactId, ...activityData } });
  }
  if (current.companyId) {
    await db.activity.create({ data: { entityType: "company", entityId: current.companyId, ...activityData } });
  }

  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
}

export async function setOpportunityOwner(id: string, ownerId: string | null) {
  const { userId, workspaceId } = await requireWorkspace();

  const [current, actor] = await Promise.all([
    db.opportunity.findUniqueOrThrow({ where: { id, workspaceId }, include: { owner: true } }),
    db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
  ]);
  const oldValue = current.owner?.name ?? current.owner?.email ?? "";

  const next = ownerId ? await db.user.findUniqueOrThrow({ where: { id: ownerId } }) : null;
  const newValue = next?.name ?? next?.email ?? "";

  if (oldValue === newValue) return;

  await db.opportunity.update({ where: { id, workspaceId }, data: { ownerId } });
  await db.activity.create({
    data: {
      workspaceId,
      entityType: "opportunity",
      entityId: id,
      field: "Owner",
      oldValue: oldValue || null,
      newValue: newValue || null,
      actorId: userId,
    },
  });

  // Only notify when someone new is actually assigned (not on unassignment), and skip
  // self-assignment — no point emailing yourself that you just did something.
  if (next?.email && next.id !== userId) {
    await sendOwnershipEmail({
      entityKind: "deal",
      recipientEmail: next.email,
      entityId: id,
      entityName: current.name || "Untitled",
      assignedByName: actor?.name ?? actor?.email ?? "Someone",
      workspaceId,
    });
  }

  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
}

export async function setExpectedCloseDate(id: string, date: Date | null) {
  const { workspaceId } = await requireWorkspace();
  await db.opportunity.update({ where: { id, workspaceId }, data: { expectedCloseDate: date } });
  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
}

// Logs to the deal's own timeline plus its contact's and company's, matching moveOpportunityStage
// — a rep looking at the person should see the deal's amount change without opening the deal.
async function logOpportunityFieldChange(
  workspaceId: string,
  userId: string | undefined,
  opportunity: { id: string; contactId: string | null; companyId: string | null },
  field: string,
  oldValue: string,
  newValue: string
) {
  const data = {
    workspaceId,
    kind: "field_update",
    field,
    oldValue: oldValue || null,
    newValue: newValue || null,
    actorId: userId,
  };
  await db.activity.create({ data: { entityType: "opportunity", entityId: opportunity.id, ...data } });
  if (opportunity.contactId) {
    await db.activity.create({ data: { entityType: "person", entityId: opportunity.contactId, ...data } });
  }
}

export async function updateOpportunityField(id: string, field: OpportunityField, rawValue: string) {
  const { userId, workspaceId } = await requireWorkspace();

  const value = rawValue.trim();
  if (field === "name" && !value) throw new Error("Name is required");

  const current = await db.opportunity.findUniqueOrThrow({ where: { id, workspaceId } });
  const oldValue = current[field] ?? "";
  if (oldValue === value) return;

  await db.opportunity.update({ where: { id, workspaceId }, data: { [field]: value || null } });
  await logOpportunityFieldChange(workspaceId, userId, current, OPPORTUNITY_FIELD_LABELS[field], oldValue, value);

  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
}

export async function setOpportunityValue(id: string, value: number) {
  const { userId, workspaceId } = await requireWorkspace();

  const amount = normalizeValue(value);
  const current = await db.opportunity.findUniqueOrThrow({ where: { id, workspaceId } });
  if (current.value === amount) return;

  await db.opportunity.update({ where: { id, workspaceId }, data: { value: amount } });
  await logOpportunityFieldChange(
    workspaceId,
    userId,
    current,
    "Amount",
    String(current.value),
    String(amount)
  );

  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
}

// Null clears the override so the deal falls back to its stage's probability.
export async function setOpportunityProbability(id: string, probability: number | null) {
  const { userId, workspaceId } = await requireWorkspace();

  const clamped = normalizeProbability(probability);

  const current = await db.opportunity.findUniqueOrThrow({ where: { id, workspaceId } });
  if (current.probability === clamped) return;

  await db.opportunity.update({ where: { id, workspaceId }, data: { probability: clamped } });
  await logOpportunityFieldChange(
    workspaceId,
    userId,
    current,
    "Probability",
    current.probability === null ? "" : `${current.probability}%`,
    clamped === null ? "" : `${clamped}%`
  );

  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
}

export async function deleteOpportunity(id: string) {
  const { workspaceId } = await requireWorkspace();

  // Soft delete — lands in Trash for 30 days (owner/admin can restore) before the purge
  // cron hard-deletes it. See settings/trash and lib/actions/trash.ts.
  const opportunity = await db.opportunity.update({ where: { id, workspaceId }, data: { deletedAt: new Date() } });

  if (opportunity.contactId) revalidatePath(`/contacts/${opportunity.contactId}`);
  if (opportunity.companyId) revalidatePath(`/companies/${opportunity.companyId}`);
  revalidatePath("/deals");
}
