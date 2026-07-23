import { db } from "@/lib/db";
import { parseCsv } from "@/lib/csv";
import { deriveCompanyNameFromEmail } from "@/lib/company-from-email";
import { getDefaultContactStageLabel } from "@/lib/actions/contact-pipeline-stages";
import type { ObjectType } from "@/lib/actions/custom-fields";

export type ImportJobData = {
  batchId: string;
  objectType: ObjectType;
  csvText: string;
  mapping: Record<string, string>; // csv header -> target field key ("name", "domain", or a CustomFieldDefinition.id prefixed with "custom:")
  userId: string;
  workspaceId: string;
};

type RowError = { row: number; message: string };

async function resolveCompanyId(workspaceId: string, name: string, userId: string, batchId: string, domain?: string | null) {
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  const company =
    (await db.company.findFirst({ where: { workspaceId, name: trimmed } })) ??
    (await db.company.create({
      data: { workspaceId, name: trimmed, domain: domain || null, createdById: userId, importBatchId: batchId },
    }));
  return company.id;
}

export async function runImport(data: ImportJobData) {
  const { batchId, objectType, csvText, mapping, userId, workspaceId } = data;

  await db.importBatch.update({ where: { id: batchId, workspaceId }, data: { status: "processing" } });

  const rows = parseCsv(csvText);
  const [header, ...dataRows] = rows;
  if (!header) {
    await db.importBatch.update({
      where: { id: batchId, workspaceId },
      data: { status: "failed", errors: [{ row: 0, message: "CSV has no rows" }] },
    });
    return;
  }

  const customFieldDefs = await db.customFieldDefinition.findMany({ where: { workspaceId, objectType } });
  const customFieldById = new Map(customFieldDefs.map((d) => [d.id, d]));
  // Fetched once per batch, not per row — every imported person lands on the same default
  // stage (or null, if the workspace hasn't set one), same as a manually-created contact.
  const defaultStage = objectType === "person" ? await getDefaultContactStageLabel(workspaceId) : null;

  const errors: RowError[] = [];
  let success = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const rowNumber = i + 2; // 1-indexed + header row
    const raw = dataRows[i];
    const record: Record<string, string> = {};
    header.forEach((colName, idx) => {
      const target = mapping[colName];
      if (target) record[target] = (raw[idx] ?? "").trim();
    });

    try {
      if (objectType === "company") {
        await importCompanyRow(workspaceId, record, batchId, userId, customFieldById);
      } else {
        await importPersonRow(workspaceId, record, batchId, userId, customFieldById, defaultStage);
      }
      success++;
    } catch (e) {
      errors.push({ row: rowNumber, message: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  await db.importBatch.update({
    where: { id: batchId, workspaceId },
    data: {
      status: "done",
      totalRows: dataRows.length,
      successRows: success,
      errorRows: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    },
  });

  return { total: dataRows.length, success, errors };
}

async function importCompanyRow(
  workspaceId: string,
  record: Record<string, string>,
  batchId: string,
  userId: string,
  customFieldById: Map<string, { id: string; key: string; label: string }>
) {
  const name = record.name?.trim();
  if (!name) throw new Error("Name is required");

  const company = await db.company.create({
    data: {
      workspaceId,
      name,
      domain: record.domain || null,
      address: record.address || null,
      linkedin: record.linkedin || null,
      annualRevenue: record.annualRevenue || null,
      createdById: userId,
      importBatchId: batchId,
    },
  });

  await db.activity.create({
    data: { workspaceId, entityType: "company", entityId: company.id, kind: "created", actorId: userId },
  });

  await writeCustomFieldValues(workspaceId, record, company.id, customFieldById);
}

async function importPersonRow(
  workspaceId: string,
  record: Record<string, string>,
  batchId: string,
  userId: string,
  customFieldById: Map<string, { id: string; key: string; label: string }>,
  defaultStage: string | null
) {
  const firstName = record.firstName?.trim();
  if (!firstName) throw new Error("First name is required");

  const email = record.email || null;
  const companyName = record.company?.trim() || (email ? deriveCompanyNameFromEmail(email) : null);
  const emailDomain = email && !record.company?.trim() ? email.split("@")[1]?.toLowerCase().trim() : null;
  const companyId = companyName ? await resolveCompanyId(workspaceId, companyName, userId, batchId, emailDomain) : undefined;

  const person = await db.person.create({
    data: {
      workspaceId,
      firstName,
      lastName: record.lastName || null,
      email,
      phone: record.phone || null,
      jobTitle: record.jobTitle || null,
      linkedin: record.linkedin || null,
      companyId,
      stage: defaultStage,
      createdById: userId,
      importBatchId: batchId,
    },
  });

  await db.activity.create({
    data: { workspaceId, entityType: "person", entityId: person.id, kind: "created", actorId: userId },
  });

  await writeCustomFieldValues(workspaceId, record, person.id, customFieldById);
}

async function writeCustomFieldValues(
  workspaceId: string,
  record: Record<string, string>,
  recordId: string,
  customFieldById: Map<string, { id: string; key: string; label: string }>
) {
  for (const [target, value] of Object.entries(record)) {
    if (!value || !target.startsWith("custom:")) continue;
    const definitionId = target.slice("custom:".length);
    if (!customFieldById.has(definitionId)) continue;
    await db.customFieldValue.create({ data: { workspaceId, definitionId, recordId, value } });
  }
}
