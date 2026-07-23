"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";

// Person <-> Company (many-to-many, on top of Person.companyId as the "primary" company)

export async function listCompanyLinksForPerson(personId: string) {
  const { workspaceId } = await requireWorkspace();
  return db.personCompany.findMany({
    where: { workspaceId, personId },
    include: { company: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function linkPersonToCompany(personId: string, companyId: string, role?: string) {
  const { workspaceId } = await requireWorkspace();

  await db.company.findUniqueOrThrow({ where: { id: companyId, workspaceId } });
  await db.person.findUniqueOrThrow({ where: { id: personId, workspaceId } });

  await db.personCompany.upsert({
    where: { personId_companyId: { personId, companyId } },
    update: { role: role?.trim() || null },
    create: { workspaceId, personId, companyId, role: role?.trim() || null },
  });

  revalidatePath(`/lead/${personId}`);
}

export async function unlinkPersonFromCompany(personId: string, companyId: string) {
  const { workspaceId } = await requireWorkspace();
  await db.personCompany.deleteMany({ where: { workspaceId, personId, companyId } });
  revalidatePath(`/lead/${personId}`);
}

// Opportunity <-> Person (many-to-many, on top of Opportunity.contactId as the "primary" contact)

export async function searchOpportunitiesToLink(query: string) {
  const { workspaceId } = await requireWorkspace();
  const q = query.trim();
  return db.opportunity.findMany({
    where: { workspaceId, deletedAt: null, ...(q ? { name: { contains: q, mode: "insensitive" } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, name: true },
  });
}

export async function listOpportunityLinksForPerson(personId: string) {
  const { workspaceId } = await requireWorkspace();
  return db.opportunityPerson.findMany({
    where: { workspaceId, personId },
    include: { opportunity: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function linkPersonToOpportunity(personId: string, opportunityId: string, role?: string) {
  const { workspaceId } = await requireWorkspace();

  await db.opportunity.findUniqueOrThrow({ where: { id: opportunityId, workspaceId } });
  await db.person.findUniqueOrThrow({ where: { id: personId, workspaceId } });

  await db.opportunityPerson.upsert({
    where: { opportunityId_personId: { opportunityId, personId } },
    update: { role: role?.trim() || null },
    create: { workspaceId, opportunityId, personId, role: role?.trim() || null },
  });

  revalidatePath(`/lead/${personId}`);
}

export async function unlinkPersonFromOpportunity(personId: string, opportunityId: string) {
  const { workspaceId } = await requireWorkspace();
  await db.opportunityPerson.deleteMany({ where: { workspaceId, personId, opportunityId } });
  revalidatePath(`/lead/${personId}`);
}
