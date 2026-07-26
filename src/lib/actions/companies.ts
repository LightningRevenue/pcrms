"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace, companyVisibilityFilter } from "@/lib/workspace";
import { db } from "@/lib/db";
import { COMPANY_FIELD_LABELS } from "@/lib/field-labels";
import { assertLimit } from "@/lib/entitlements";
import { sendOwnershipEmail } from "@/lib/ownership-notification";
import {
  deriveRevenueRange,
  employeeBucketLabel,
  parseEmployeeCountInput,
} from "@/lib/firmographics";

export type CreateCompanyInput = {
  name: string;
  domain?: string;
  address?: string;
  linkedin?: string;
  annualRevenue?: string;
  industry?: string;
  country?: string;
  /** Free text from the form; non-numeric input is ignored rather than rejected. */
  employeeCount?: string;
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
      industry: input.industry?.trim() || null,
      country: input.country?.trim() || null,
      revenueRange: deriveRevenueRange(input.annualRevenue),
      // Accepts a bucket label from the picker or a plain number from the API.
      employeeCount: parseEmployeeCountInput(input.employeeCount),
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

export async function setCompanyOwner(companyId: string, ownerId: string | null) {
  const { userId, workspaceId } = await requireWorkspace();

  const [current, actor] = await Promise.all([
    db.company.findUniqueOrThrow({ where: { id: companyId, workspaceId }, include: { owner: true } }),
    db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
  ]);
  const oldValue = current.owner?.name ?? current.owner?.email ?? "";

  const next = ownerId ? await db.user.findUniqueOrThrow({ where: { id: ownerId } }) : null;
  const newValue = next?.name ?? next?.email ?? "";
  if (oldValue === newValue) return;

  await db.company.update({ where: { id: companyId, workspaceId }, data: { ownerId } });
  await db.activity.create({
    data: {
      workspaceId,
      entityType: "company",
      entityId: companyId,
      field: "Owner",
      oldValue: oldValue || null,
      newValue: newValue || null,
      actorId: userId,
    },
  });

  if (next?.email && next.id !== userId) {
    await sendOwnershipEmail({
      entityKind: "company",
      recipientEmail: next.email,
      entityId: companyId,
      entityName: current.name || "Untitled",
      assignedByName: actor?.name ?? actor?.email ?? "Someone",
      workspaceId,
    });
  }

  revalidatePath(`/companies/${companyId}`);
  revalidatePath("/companies");
}

export async function updateCompanyField(companyId: string, field: CompanyField, rawValue: string) {
  const { userId, workspaceId } = await requireWorkspace();

  const value = rawValue.trim();
  if (field === "name" && !value) throw new Error("Name is required");

  const current = await db.company.findUniqueOrThrow({ where: { id: companyId, workspaceId } });
  const oldValue = current[field] ?? "";
  if (oldValue === value) return;

  // Setting Annual Revenue also fills in the bucketed Revenue Range, so the filterable field
  // keeps up with the free-text one. Only when the text actually parses — unparseable input
  // ("confidential") leaves whatever range was chosen by hand alone.
  const data: Record<string, string | null> = { [field]: value || null };
  if (field === "annualRevenue") {
    const derived = deriveRevenueRange(value);
    if (derived) data.revenueRange = derived;
  }

  await db.company.update({ where: { id: companyId, workspaceId }, data });
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

// employeeCount is the one Company field that isn't a string, so it can't go through
// updateCompanyField (which writes the raw trimmed text). Accepts either a bucket label from
// the picker ("201-500") or a plain number (CSV/API), since both reach this path. Blank
// clears it; anything else is rejected rather than silently stored as 0.
export async function updateCompanyEmployeeCount(companyId: string, rawValue: string) {
  const { userId, workspaceId } = await requireWorkspace();

  const trimmed = rawValue.trim();
  const value = parseEmployeeCountInput(trimmed);
  if (trimmed && value === null) throw new Error("Employee count must be a positive number");

  const current = await db.company.findUniqueOrThrow({ where: { id: companyId, workspaceId } });
  if (current.employeeCount === value) return;

  // An exact count (e.g. 320 from an import) already inside the picked bucket is left alone —
  // re-selecting the bucket it's displayed as shouldn't coarsen it to the bucket's lower bound.
  if (
    value !== null &&
    current.employeeCount !== null &&
    employeeBucketLabel(current.employeeCount) === employeeBucketLabel(value)
  ) {
    return;
  }

  await db.company.update({ where: { id: companyId, workspaceId }, data: { employeeCount: value } });
  await db.activity.create({
    data: {
      workspaceId,
      entityType: "company",
      entityId: companyId,
      field: "Employees",
      oldValue: current.employeeCount?.toString() ?? null,
      newValue: value?.toString() ?? null,
      actorId: userId,
    },
  });

  revalidatePath(`/companies/${companyId}`);
  revalidatePath("/companies");
}
