"use server";

import { requireWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { parseCsv } from "@/lib/csv";
import { guessMapping, STANDARD_IMPORT_FIELDS, type ImportField } from "@/lib/import-fields";
import { importQueue } from "@/lib/import-queue";
import type { ObjectType } from "@/lib/actions/custom-fields";
import { assertLimit, checkLimit, EntitlementLimitError } from "@/lib/entitlements";

export async function parseCsvPreview(objectType: ObjectType, csvText: string) {
  const { workspaceId } = await requireWorkspace();
  const rows = parseCsv(csvText);
  const [header, ...dataRows] = rows;
  if (!header) throw new Error("CSV appears to be empty");

  const customFields = await db.customFieldDefinition.findMany({ where: { workspaceId, objectType } });
  const fields: ImportField[] = [
    ...STANDARD_IMPORT_FIELDS[objectType],
    ...customFields.map((f) => ({ key: `custom:${f.id}`, label: f.label, isCustom: true })),
  ];

  return {
    headers: header,
    preview: dataRows.slice(0, 5),
    rowCount: dataRows.length,
    fields,
    suggestedMapping: guessMapping(header, fields),
  };
}

export async function startImport(
  objectType: ObjectType,
  name: string,
  csvText: string,
  mapping: Record<string, string>
) {
  const { userId, workspaceId } = await requireWorkspace();
  await assertLimit(workspaceId, "csv_import_feature");

  const batchName = name.trim();
  if (!batchName) throw new Error("Import name is required");

  // Row count isn't known until the CSV is parsed — check current usage + this batch's
  // rows against the monthly cap here, before enqueueing, rather than mid-worker.
  const rowCount = parseCsv(csvText).length - 1;
  const usage = await checkLimit(workspaceId, "import_rows_monthly");
  if (usage.limit !== null && usage.current + Math.max(rowCount, 0) > usage.limit) {
    throw new EntitlementLimitError("import_rows_monthly", usage.limit, usage.current);
  }

  const batch = await db.importBatch.create({
    data: {
      workspaceId,
      name: batchName,
      objectType,
      status: "pending",
      createdById: userId,
    },
  });

  await importQueue.add(batch.id, {
    batchId: batch.id,
    objectType,
    csvText,
    mapping,
    userId,
    workspaceId,
  });

  return batch.id;
}

export async function getImportBatch(id: string) {
  const { workspaceId } = await requireWorkspace();
  return db.importBatch.findUnique({ where: { id, workspaceId } });
}

export async function listImportBatches() {
  const { workspaceId } = await requireWorkspace();
  return db.importBatch.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 20 });
}
