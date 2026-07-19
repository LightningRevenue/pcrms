"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseCsv } from "@/lib/csv";
import { guessMapping, STANDARD_IMPORT_FIELDS, type ImportField } from "@/lib/import-fields";
import { importQueue } from "@/lib/import-queue";
import type { ObjectType } from "@/lib/actions/custom-fields";

export async function parseCsvPreview(objectType: ObjectType, csvText: string) {
  const rows = parseCsv(csvText);
  const [header, ...dataRows] = rows;
  if (!header) throw new Error("CSV appears to be empty");

  const customFields = await db.customFieldDefinition.findMany({ where: { objectType } });
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
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const batchName = name.trim();
  if (!batchName) throw new Error("Import name is required");

  const batch = await db.importBatch.create({
    data: {
      name: batchName,
      objectType,
      status: "pending",
      createdById: session.user.id,
    },
  });

  await importQueue.add(batch.id, {
    batchId: batch.id,
    objectType,
    csvText,
    mapping,
    userId: session.user.id,
  });

  return batch.id;
}

export async function getImportBatch(id: string) {
  return db.importBatch.findUnique({ where: { id } });
}

export async function listImportBatches() {
  return db.importBatch.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
}
