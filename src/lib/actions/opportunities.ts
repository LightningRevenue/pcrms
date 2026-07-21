"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace, opportunityVisibilityFilter } from "@/lib/workspace";
import { db } from "@/lib/db";
import { assertLimit } from "@/lib/entitlements";

export type OpportunityStage = string;

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
  return db.opportunity.findMany({
    where: { workspaceId: ctx.workspaceId, ...opportunityVisibilityFilter(ctx) },
    include: { company: true, contact: true, owner: true, createdBy: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOpportunity(id: string) {
  const ctx = await requireWorkspace();
  return db.opportunity.findUnique({
    where: { id, workspaceId: ctx.workspaceId, ...opportunityVisibilityFilter(ctx) },
    include: { company: true, contact: true, owner: true, createdBy: true },
  });
}

export async function moveOpportunityStage(id: string, stage: OpportunityStage) {
  const { userId, workspaceId } = await requireWorkspace();

  const current = await db.opportunity.findUniqueOrThrow({ where: { id, workspaceId } });
  if (current.stage === stage) return;

  const target = await db.pipelineStage.findUnique({ where: { workspaceId_label: { workspaceId, label: stage } } });
  const closeDate = !target || target.outcome === "open" ? null : new Date();

  await db.opportunity.update({ where: { id, workspaceId }, data: { stage, closeDate } });

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

  const current = await db.opportunity.findUniqueOrThrow({ where: { id, workspaceId }, include: { owner: true } });
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
