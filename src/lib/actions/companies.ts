"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace, companyVisibilityFilter } from "@/lib/workspace";
import { db } from "@/lib/db";
import { COMPANY_FIELD_LABELS } from "@/lib/field-labels";
import { assertLimit } from "@/lib/entitlements";

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
  const { userId, workspaceId } = await requireWorkspace();
  await assertLimit(workspaceId, "companies_count");

  const name = input.name.trim();
  if (!name) throw new Error("Name is required");

  const company = await db.company.create({
    data: {
      workspaceId,
      name,
      domain: input.domain?.trim() || null,
      address: input.address?.trim() || null,
      linkedin: input.linkedin?.trim() || null,
      annualRevenue: input.annualRevenue?.trim() || null,
      createdById: userId,
    },
  });

  await db.activity.create({
    data: { workspaceId, entityType: "company", entityId: company.id, kind: "created", actorId: userId },
  });

  revalidatePath("/companies");
}

export async function deleteCompanies(ids: string[]) {
  const { workspaceId } = await requireWorkspace();
  if (ids.length === 0) return { deleted: 0, skipped: 0 };

  const blocked = await db.person.findMany({
    where: { workspaceId, companyId: { in: ids }, deletedAt: null },
    select: { companyId: true },
    distinct: ["companyId"],
  });
  const blockedByPeople = new Set(blocked.map((p) => p.companyId));

  const blockedByOpportunities = await db.opportunity.findMany({
    where: { workspaceId, companyId: { in: ids }, deletedAt: null },
    select: { companyId: true },
    distinct: ["companyId"],
  });
  for (const o of blockedByOpportunities) if (o.companyId) blockedByPeople.add(o.companyId);

  const deletable = ids.filter((id) => !blockedByPeople.has(id));

  // Soft delete — rows land in Trash for 30 days (owner/admin can restore) before the
  // purge cron hard-deletes them. See settings/trash and lib/actions/trash.ts.
  const { count } = await db.company.updateMany({
    where: { workspaceId, id: { in: deletable } },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/companies");
  return { deleted: count, skipped: ids.length - deletable.length };
}

// Deleting a company has no related entity left standing to log a "removed" note on
// (people/opportunities pointing at it block the delete above), so there's nothing to fan out to.

export async function searchCompanies(query: string) {
  const ctx = await requireWorkspace();
  const q = query.trim();
  if (!q) return [];
  return db.company.findMany({
    where: { workspaceId: ctx.workspaceId, name: { contains: q, mode: "insensitive" }, ...companyVisibilityFilter(ctx) },
    orderBy: { name: "asc" },
    take: 8,
    select: { id: true, name: true },
  });
}

export async function linkPersonToCompany(companyId: string, personId: string) {
  const { userId, workspaceId } = await requireWorkspace();

  const [company, person] = await Promise.all([
    db.company.findUniqueOrThrow({ where: { id: companyId, workspaceId } }),
    db.person.findUniqueOrThrow({ where: { id: personId, workspaceId }, include: { company: true } }),
  ]);

  const oldValue = person.company?.name ?? "";
  if (oldValue === company.name) return;

  await db.person.update({ where: { id: personId, workspaceId }, data: { companyId } });

  const personName = [person.firstName, person.lastName].filter(Boolean).join(" ");
  await db.activity.create({
    data: {
      workspaceId,
      entityType: "person",
      entityId: personId,
      field: "Company",
      oldValue: oldValue || null,
      newValue: company.name,
      actorId: userId,
    },
  });
  await db.activity.create({
    data: {
      workspaceId,
      entityType: "company",
      entityId: companyId,
      field: "Person",
      newValue: personName,
      actorId: userId,
    },
  });

  revalidatePath(`/companies/${companyId}`);
  revalidatePath(`/contacts/${personId}`);
  revalidatePath("/contacts");
}

export async function unlinkPersonFromCompany(companyId: string, personId: string) {
  const { userId, workspaceId } = await requireWorkspace();

  const [company, person] = await Promise.all([
    db.company.findUniqueOrThrow({ where: { id: companyId, workspaceId } }),
    db.person.findUniqueOrThrow({ where: { id: personId, workspaceId } }),
  ]);

  await db.person.update({ where: { id: personId, workspaceId }, data: { companyId: null } });

  const personName = [person.firstName, person.lastName].filter(Boolean).join(" ");
  await db.activity.create({
    data: {
      workspaceId,
      entityType: "person",
      entityId: personId,
      field: "Company",
      oldValue: company.name,
      newValue: null,
      actorId: userId,
    },
  });
  await db.activity.create({
    data: {
      workspaceId,
      entityType: "company",
      entityId: companyId,
      field: "Person",
      oldValue: personName,
      newValue: null,
      actorId: userId,
    },
  });

  revalidatePath(`/companies/${companyId}`);
  revalidatePath(`/contacts/${personId}`);
  revalidatePath("/contacts");
}

export async function updateCompanyField(companyId: string, field: CompanyField, rawValue: string) {
  const { userId, workspaceId } = await requireWorkspace();

  const value = rawValue.trim();
  if (field === "name" && !value) throw new Error("Name is required");

  const current = await db.company.findUniqueOrThrow({ where: { id: companyId, workspaceId } });
  const oldValue = current[field] ?? "";
  if (oldValue === value) return;

  await db.company.update({ where: { id: companyId, workspaceId }, data: { [field]: value || null } });
  await db.activity.create({
    data: {
      workspaceId,
      entityType: "company",
      entityId: companyId,
      field: FIELD_LABELS[field],
      oldValue: oldValue || null,
      newValue: value || null,
      actorId: userId,
    },
  });

  revalidatePath(`/companies/${companyId}`);
  revalidatePath("/companies");
}
