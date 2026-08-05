"use server";

import { requirePlatformAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { parseCsv, toCsv } from "@/lib/csv";
import { verifyQueue } from "@/lib/verify-queue";
// DownloadKind is deliberately NOT re-exported from here — a "use server" module may only
// export async functions, and the type re-export gets compiled into a broken server action.
// Import it from "@/lib/verify-api" instead.
import { DOWNLOAD_STATUSES, guessEmailColumn, type DownloadKind } from "@/lib/verify-api";

export async function parseVerifyCsvPreview(csvText: string) {
  await requirePlatformAdmin();
  const rows = parseCsv(csvText);
  const [header, ...dataRows] = rows;
  if (!header) throw new Error("CSV appears to be empty");
  if (dataRows.length === 0) throw new Error("CSV has a header but no data rows");

  return {
    headers: header,
    preview: dataRows.slice(0, 5),
    rowCount: dataRows.length,
    suggestedColumn: guessEmailColumn(header, dataRows.slice(0, 20)),
  };
}

export async function startVerifyBatch(
  name: string,
  csvText: string,
  emailColumn: string,
  tags: string[]
) {
  const { userId } = await requirePlatformAdmin();

  const batchName = name.trim();
  if (!batchName) throw new Error("Batch name is required");

  const rows = parseCsv(csvText);
  const [header] = rows;
  if (!header) throw new Error("CSV appears to be empty");
  if (!header.includes(emailColumn)) throw new Error(`Column "${emailColumn}" not found in CSV`);

  const batch = await db.verifyBatch.create({
    data: {
      name: batchName,
      status: "pending",
      tags: tags.map((t) => t.trim()).filter(Boolean),
      emailColumn,
      sourceCsv: csvText,
      totalRows: rows.length - 1,
      createdById: userId,
    },
  });

  await verifyQueue.add(batch.id, { batchId: batch.id });

  return batch.id;
}

export async function getVerifyBatch(id: string) {
  await requirePlatformAdmin();
  return db.verifyBatch.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      status: true,
      tags: true,
      emailColumn: true,
      totalRows: true,
      checkedRows: true,
      validRows: true,
      invalidRows: true,
      catchAllRows: true,
      error: true,
      createdAt: true,
    },
  });
}

export async function listVerifyBatches() {
  await requirePlatformAdmin();
  return db.verifyBatch.findMany({
    // sourceCsv is deliberately not selected — the list would carry every uploaded file.
    select: {
      id: true,
      name: true,
      status: true,
      tags: true,
      totalRows: true,
      checkedRows: true,
      validRows: true,
      invalidRows: true,
      catchAllRows: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function updateVerifyBatchTags(id: string, tags: string[]) {
  await requirePlatformAdmin();
  await db.verifyBatch.update({
    where: { id },
    data: { tags: tags.map((t) => t.trim()).filter(Boolean) },
  });
}

export async function deleteVerifyBatch(id: string) {
  await requirePlatformAdmin();
  await db.verifyBatch.delete({ where: { id } }); // results cascade
}

// Rebuilds a CSV with the original columns plus the verification verdict, so the download is a
// drop-in replacement for the uploaded file rather than a separate thing to join back.
export async function downloadVerifyCsv(id: string, kind: DownloadKind) {
  await requirePlatformAdmin();

  const batch = await db.verifyBatch.findUnique({
    where: { id },
    select: { name: true, sourceCsv: true },
  });
  if (!batch) throw new Error("Batch not found");

  const [header] = parseCsv(batch.sourceCsv);
  if (!header) throw new Error("Batch CSV is empty");

  const statuses = DOWNLOAD_STATUSES[kind];
  const results = await db.verifyResult.findMany({
    where: { batchId: id, ...(statuses ? { status: { in: statuses } } : {}) },
    select: { status: true, reason: true, row: true },
    orderBy: { rowIndex: "asc" }, // preserve the uploaded file's row order
  });

  const rows = [
    [...header, "verify_status", "verify_reason"],
    ...results.map((r) => [...(r.row as string[]), r.status, r.reason ?? ""]),
  ];

  return { filename: `${batch.name}-${kind}.csv`, csv: toCsv(rows) };
}
