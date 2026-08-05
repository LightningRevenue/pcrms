import { db } from "@/lib/db";
import { parseCsv } from "@/lib/csv";
import { callVerifyApi, statusOf } from "@/lib/verify-api";

export type VerifyJobData = { batchId: string };

// Same fixed-worker-pool shape as the old in-memory batch runner in actions/email-verify.ts.
// No delay or backoff: the verify service is ours, and 8 concurrent SMTP handshakes is what
// it was already being driven at.
// ponytail: concurrency capping only, no token bucket. Add one if the service starts 429ing.
const CONCURRENCY = 8;

export async function runVerify({ batchId }: VerifyJobData) {
  const batch = await db.verifyBatch.findUnique({ where: { id: batchId } });
  if (!batch) return;

  await db.verifyBatch.update({ where: { id: batchId }, data: { status: "processing" } });

  try {
    const rows = parseCsv(batch.sourceCsv);
    const [header, ...dataRows] = rows;
    if (!header) throw new Error("CSV has no rows");

    const emailIdx = header.indexOf(batch.emailColumn);
    if (emailIdx === -1) throw new Error(`Column "${batch.emailColumn}" not found in CSV`);

    // Every input row gets exactly one result row, so a download is never shorter than the
    // upload. Keyed by row index, not email: a lead list legitimately repeats an address
    // (several people at one firm, or the same person scraped twice) and dropping duplicates
    // would silently lose those rows.
    const existing = await db.verifyResult.findMany({
      where: { batchId },
      select: { rowIndex: true },
    });
    const done = new Set(existing.map((r) => r.rowIndex));

    const pending = dataRows
      .map((row, rowIndex) => ({ row, rowIndex, email: (row[emailIdx] ?? "").trim() }))
      // Resume after a retry/restart: rows already written cost real API calls to redo.
      .filter((r) => !done.has(r.rowIndex));

    await db.verifyBatch.update({
      where: { id: batchId },
      data: { totalRows: dataRows.length },
    });

    // One API call per distinct address even when it appears on many rows. Shared across the
    // worker pool, so the second occurrence reuses the first's verdict.
    const seen = new Map<string, { status: string; reason: string | null }>();

    let cursor = 0;
    async function worker() {
      while (cursor < pending.length) {
        const { row, rowIndex, email } = pending[cursor++];
        let status: string;
        let reason: string | null;

        const cached = seen.get(email);
        if (!email) {
          // Blank cell — no address to check. Recorded rather than skipped so the row still
          // appears in the "Everything" download and the counts add up to totalRows.
          status = "invalid";
          reason = "No email address";
        } else if (cached) {
          ({ status, reason } = cached);
        } else {
          try {
            const result = await callVerifyApi(email);
            status = statusOf(result);
            reason = result.reason;
          } catch (e) {
            // A failed check is not a verdict on the address — mark it "invalid" (matching the
            // existing runner) but keep the error text so it's distinguishable on download.
            status = "invalid";
            reason = e instanceof Error ? e.message : "Verification failed";
          }
          seen.set(email, { status, reason });
        }

        await db.verifyResult.create({ data: { batchId, email, rowIndex, status, reason, row } });
        await db.verifyBatch.update({
          where: { id: batchId },
          data: {
            checkedRows: { increment: 1 },
            ...(status === "valid"
              ? { validRows: { increment: 1 } }
              : status === "catch-all"
                ? { catchAllRows: { increment: 1 } }
                : { invalidRows: { increment: 1 } }),
          },
        });
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker));

    await db.verifyBatch.update({ where: { id: batchId }, data: { status: "done" } });
  } catch (e) {
    await db.verifyBatch.update({
      where: { id: batchId },
      data: { status: "failed", error: e instanceof Error ? e.message : "Verification failed" },
    });
    throw e;
  }
}
