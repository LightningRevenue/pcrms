"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { COMPANY_FIELD_LABELS } from "@/lib/field-labels";

export type CreateCompanyInput = {
  name: string;
  domain?: string;
  address?: string;
  linkedin?: string;
  annualRevenue?: string;
};

const FIELD_LABELS = COMPANY_FIELD_LABELS;

export type CompanyField = keyof typeof FIELD_LABELS;

export async function createCompany(input: CreateCompanyInput) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const name = input.name.trim();
  if (!name) throw new Error("Name is required");

  const company = await db.company.create({
    data: {
      name,
      domain: input.domain?.trim() || null,
      address: input.address?.trim() || null,
      linkedin: input.linkedin?.trim() || null,
      annualRevenue: input.annualRevenue?.trim() || null,
      createdById: session.user.id,
    },
  });

  await db.activity.create({
    data: { entityType: "company", entityId: company.id, kind: "created", actorId: session.user.id },
  });

  revalidatePath("/companies");
}

export async function deleteCompanies(ids: string[]) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  if (ids.length === 0) return { deleted: 0, skipped: 0 };

  const blocked = await db.person.findMany({
    where: { companyId: { in: ids } },
    select: { companyId: true },
    distinct: ["companyId"],
  });
  const blockedByPeople = new Set(blocked.map((p) => p.companyId));

  const blockedByOpportunities = await db.opportunity.findMany({
    where: { companyId: { in: ids } },
    select: { companyId: true },
    distinct: ["companyId"],
  });
  for (const o of blockedByOpportunities) if (o.companyId) blockedByPeople.add(o.companyId);

  const deletable = ids.filter((id) => !blockedByPeople.has(id));

  const { count } = await db.company.deleteMany({ where: { id: { in: deletable } } });

  revalidatePath("/companies");
  return { deleted: count, skipped: ids.length - deletable.length };
}

// Deleting a company has no related entity left standing to log a "removed" note on
// (people/opportunities pointing at it block the delete above), so there's nothing to fan out to.

export async function searchCompanies(query: string) {
  const q = query.trim();
  if (!q) return [];
  return db.company.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    orderBy: { name: "asc" },
    take: 8,
    select: { id: true, name: true },
  });
}

export async function linkPersonToCompany(companyId: string, personId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const [company, person] = await Promise.all([
    db.company.findUniqueOrThrow({ where: { id: companyId } }),
    db.person.findUniqueOrThrow({ where: { id: personId }, include: { company: true } }),
  ]);

  const oldValue = person.company?.name ?? "";
  if (oldValue === company.name) return;

  await db.person.update({ where: { id: personId }, data: { companyId } });

  const personName = [person.firstName, person.lastName].filter(Boolean).join(" ");
  await db.activity.create({
    data: {
      entityType: "person",
      entityId: personId,
      field: "Company",
      oldValue: oldValue || null,
      newValue: company.name,
      actorId: session.user.id,
    },
  });
  await db.activity.create({
    data: {
      entityType: "company",
      entityId: companyId,
      field: "Person",
      newValue: personName,
      actorId: session.user.id,
    },
  });

  revalidatePath(`/companies/${companyId}`);
  revalidatePath(`/contacts/${personId}`);
  revalidatePath("/contacts");
}

export async function unlinkPersonFromCompany(companyId: string, personId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const [company, person] = await Promise.all([
    db.company.findUniqueOrThrow({ where: { id: companyId } }),
    db.person.findUniqueOrThrow({ where: { id: personId } }),
  ]);

  await db.person.update({ where: { id: personId }, data: { companyId: null } });

  const personName = [person.firstName, person.lastName].filter(Boolean).join(" ");
  await db.activity.create({
    data: {
      entityType: "person",
      entityId: personId,
      field: "Company",
      oldValue: company.name,
      newValue: null,
      actorId: session.user.id,
    },
  });
  await db.activity.create({
    data: {
      entityType: "company",
      entityId: companyId,
      field: "Person",
      oldValue: personName,
      newValue: null,
      actorId: session.user.id,
    },
  });

  revalidatePath(`/companies/${companyId}`);
  revalidatePath(`/contacts/${personId}`);
  revalidatePath("/contacts");
}

export async function updateCompanyField(companyId: string, field: CompanyField, rawValue: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const value = rawValue.trim();
  if (field === "name" && !value) throw new Error("Name is required");

  const current = await db.company.findUniqueOrThrow({ where: { id: companyId } });
  const oldValue = current[field] ?? "";
  if (oldValue === value) return;

  await db.company.update({ where: { id: companyId }, data: { [field]: value || null } });
  await db.activity.create({
    data: {
      entityType: "company",
      entityId: companyId,
      field: FIELD_LABELS[field],
      oldValue: oldValue || null,
      newValue: value || null,
      actorId: session.user.id,
    },
  });

  revalidatePath(`/companies/${companyId}`);
  revalidatePath("/companies");
}
