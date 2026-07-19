"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export type OpportunityStage = string;

export type ConvertToOpportunityInput = {
  personId: string;
  name: string;
  stage: OpportunityStage;
  value: number;
};

export async function convertContactToOpportunity(input: ConvertToOpportunityInput) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const name = input.name.trim();
  if (!name) throw new Error("Deal name is required");

  const contact = await db.person.findUniqueOrThrow({ where: { id: input.personId } });

  const opportunity = await db.opportunity.create({
    data: {
      name,
      stage: input.stage,
      value: input.value,
      companyId: contact.companyId,
      contactId: contact.id,
      ownerId: session.user.id,
      createdById: session.user.id,
    },
  });

  await db.activity.create({
    data: {
      entityType: "opportunity",
      entityId: opportunity.id,
      kind: "created",
      actorId: session.user.id,
    },
  });
  await db.activity.create({
    data: {
      entityType: "person",
      entityId: contact.id,
      kind: "opportunity_created",
      field: "Opportunity",
      newValue: name,
      actorId: session.user.id,
    },
  });
  if (contact.companyId) {
    await db.activity.create({
      data: {
        entityType: "company",
        entityId: contact.companyId,
        kind: "opportunity_created",
        field: "Opportunity",
        newValue: name,
        actorId: session.user.id,
      },
    });
  }

  revalidatePath(`/contacts/${contact.id}`);
  if (contact.companyId) revalidatePath(`/companies/${contact.companyId}`);

  return opportunity;
}

export async function listOpportunitiesForPerson(personId: string) {
  return db.opportunity.findMany({ where: { contactId: personId }, orderBy: { createdAt: "desc" } });
}

export async function listOpportunitiesForCompany(companyId: string) {
  return db.opportunity.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } });
}

export async function listOpportunities() {
  return db.opportunity.findMany({
    include: { company: true, contact: true, owner: true, createdBy: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOpportunity(id: string) {
  return db.opportunity.findUnique({
    where: { id },
    include: { company: true, contact: true, owner: true, createdBy: true },
  });
}

export async function moveOpportunityStage(id: string, stage: OpportunityStage) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const current = await db.opportunity.findUniqueOrThrow({ where: { id } });
  if (current.stage === stage) return;

  const target = await db.pipelineStage.findUnique({ where: { label: stage } });
  const closeDate = !target || target.outcome === "open" ? null : new Date();

  await db.opportunity.update({ where: { id }, data: { stage, closeDate } });

  const activityData = {
    kind: "stage_changed",
    field: "Stage",
    oldValue: current.stage,
    newValue: stage,
    actorId: session.user.id,
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
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const current = await db.opportunity.findUniqueOrThrow({ where: { id }, include: { owner: true } });
  const oldValue = current.owner?.name ?? current.owner?.email ?? "";

  const next = ownerId ? await db.user.findUniqueOrThrow({ where: { id: ownerId } }) : null;
  const newValue = next?.name ?? next?.email ?? "";

  if (oldValue === newValue) return;

  await db.opportunity.update({ where: { id }, data: { ownerId } });
  await db.activity.create({
    data: {
      entityType: "opportunity",
      entityId: id,
      field: "Owner",
      oldValue: oldValue || null,
      newValue: newValue || null,
      actorId: session.user.id,
    },
  });

  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
}

export async function deleteOpportunity(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const opportunity = await db.opportunity.delete({ where: { id } });

  if (opportunity.contactId) revalidatePath(`/contacts/${opportunity.contactId}`);
  if (opportunity.companyId) revalidatePath(`/companies/${opportunity.companyId}`);
  revalidatePath("/deals");
}
