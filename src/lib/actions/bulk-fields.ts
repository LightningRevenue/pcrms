"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireWorkspace, personVisibilityFilter, companyVisibilityFilter } from "@/lib/workspace";
import { deriveRevenueRange, parseEmployeeCountInput, employeeBucketLabel } from "@/lib/firmographics";

// Bulk edit for the firmographic/segmentation fields surfaced in the /companies and /contacts
// selection bars. Deliberately a small whitelist rather than "any column": these are the
// fields that drive Lead Intelligence filters, and a generic bulk-writer over arbitrary
// columns is a much bigger blast radius than this needs.
//
// Every write is workspace-scoped and visibility-filtered, and each changed record gets an
// Activity row so a bulk edit is as auditable as a single one.

export const BULK_COMPANY_FIELDS = ["industry", "country", "revenueRange", "employeeCount"] as const;
export type BulkCompanyField = (typeof BULK_COMPANY_FIELDS)[number];

export const BULK_COMPANY_LABELS: Record<BulkCompanyField, string> = {
  industry: "Industry",
  country: "Country",
  revenueRange: "Revenue Range",
  employeeCount: "Employees",
};

// Person-side: stage is the one segmentation field that's directly editable. seniority and
// department are derived from jobTitle (lib/job-title.ts) and deliberately excluded — setting
// them by hand would be silently overwritten the next time the title is edited.
export const BULK_PERSON_FIELDS = ["stage"] as const;
export type BulkPersonField = (typeof BULK_PERSON_FIELDS)[number];

export const BULK_PERSON_LABELS: Record<BulkPersonField, string> = {
  stage: "Stage",
};

export async function bulkUpdateCompanyField(
  companyIds: string[],
  field: BulkCompanyField,
  rawValue: string
) {
  const ctx = await requireWorkspace();
  const { userId, workspaceId } = ctx;
  if (companyIds.length === 0) return { updated: 0 };
  if (!BULK_COMPANY_FIELDS.includes(field)) throw new Error("That field can't be bulk-edited.");

  const value = rawValue.trim();

  // Only touch rows the caller may actually see.
  const targets = await db.company.findMany({
    where: { id: { in: companyIds }, workspaceId, ...companyVisibilityFilter(ctx) },
    select: { id: true, industry: true, country: true, revenueRange: true, employeeCount: true },
  });

  let updated = 0;
  for (const company of targets) {
    const data: Record<string, string | number | null> = {};
    let oldValue: string;
    let newValue: string;

    if (field === "employeeCount") {
      const parsed = parseEmployeeCountInput(value);
      if (value && parsed === null) throw new Error("Employee count must be a positive number");
      // An exact count already inside the picked bucket is left alone, so a bulk set doesn't
      // coarsen 320 down to the bucket's lower bound. Same rule as the single-record edit.
      if (
        parsed !== null &&
        company.employeeCount !== null &&
        employeeBucketLabel(company.employeeCount) === employeeBucketLabel(parsed)
      ) {
        continue;
      }
      if (company.employeeCount === parsed) continue;
      data.employeeCount = parsed;
      oldValue = company.employeeCount?.toString() ?? "";
      newValue = parsed?.toString() ?? "";
    } else {
      const current = company[field] ?? "";
      if (current === value) continue;
      data[field] = value || null;
      oldValue = current;
      newValue = value;
    }

    await db.company.update({ where: { id: company.id, workspaceId }, data });
    await db.activity.create({
      data: {
        workspaceId,
        entityType: "company",
        entityId: company.id,
        field: BULK_COMPANY_LABELS[field],
        oldValue: oldValue || null,
        newValue: newValue || null,
        actorId: userId,
      },
    });
    updated++;
  }

  revalidatePath("/companies");
  revalidatePath("/lead-intelligence");
  return { updated };
}

export async function bulkUpdatePersonField(personIds: string[], field: BulkPersonField, rawValue: string) {
  const ctx = await requireWorkspace();
  const { userId, workspaceId } = ctx;
  if (personIds.length === 0) return { updated: 0 };
  if (!BULK_PERSON_FIELDS.includes(field)) throw new Error("That field can't be bulk-edited.");

  const value = rawValue.trim();

  const targets = await db.person.findMany({
    where: { id: { in: personIds }, workspaceId, ...personVisibilityFilter(ctx) },
    select: { id: true, stage: true },
  });

  let updated = 0;
  for (const person of targets) {
    const current = person[field] ?? "";
    if (current === value) continue;

    await db.person.update({ where: { id: person.id, workspaceId }, data: { [field]: value || null } });
    await db.activity.create({
      data: {
        workspaceId,
        entityType: "person",
        entityId: person.id,
        field: BULK_PERSON_LABELS[field],
        oldValue: current || null,
        newValue: value || null,
        actorId: userId,
      },
    });
    updated++;
  }

  revalidatePath("/contacts");
  revalidatePath("/lead-intelligence");
  return { updated };
}

// Bulk-sets the company on a set of contacts, then applies firmographics to that company —
// the "these 20 leads are all from Acme" case. Kept separate from bulkUpdatePersonField
// because it writes to a different table than the one being selected.
export async function bulkUpdateCompanyForContacts(personIds: string[], field: BulkCompanyField, rawValue: string) {
  const ctx = await requireWorkspace();
  if (personIds.length === 0) return { updated: 0, skipped: 0 };

  const people = await db.person.findMany({
    where: { id: { in: personIds }, workspaceId: ctx.workspaceId, ...personVisibilityFilter(ctx) },
    select: { companyId: true },
  });

  const companyIds = [...new Set(people.map((p) => p.companyId).filter((id): id is string => !!id))];
  const skipped = people.filter((p) => !p.companyId).length;

  const res = await bulkUpdateCompanyField(companyIds, field, rawValue);
  return { updated: res.updated, skipped };
}
