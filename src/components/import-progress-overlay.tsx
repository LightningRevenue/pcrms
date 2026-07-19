"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { getImportBatch } from "@/lib/actions/import";
import type { ImportBatch } from "@prisma/client";

const POLL_MS = 1200;

export function ImportProgressOverlay({ batchId, onDone }: { batchId: string; onDone: () => void }) {
  const [batch, setBatch] = useState<ImportBatch | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      const b = await getImportBatch(batchId);
      if (cancelled) return;
      setBatch(b);
      if (b && (b.status === "done" || b.status === "failed")) return;
      timer = setTimeout(poll, POLL_MS);
    }
    poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [batchId]);

  const finished = batch?.status === "done" || batch?.status === "failed";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-sm bg-background border border-border rounded-lg shadow-2xl p-6 text-center">
        {!finished ? (
          <>
            <Loader2 size={28} strokeWidth={1.75} className="mx-auto animate-spin text-accent" />
            <p className="text-[13px] font-medium mt-3">Importing…</p>
            <p className="text-[12px] text-subtle mt-1">This may take a moment for large files.</p>
          </>
        ) : batch?.status === "done" ? (
          <>
            <CheckCircle2 size={28} strokeWidth={1.75} className="mx-auto text-emerald-400" />
            <p className="text-[13px] font-medium mt-3">Import complete</p>
            <p className="text-[12px] text-subtle mt-1">
              {batch.successRows} of {batch.totalRows} rows imported
              {batch.errorRows > 0 ? `, ${batch.errorRows} failed` : ""}.
            </p>
            <button
              onClick={onDone}
              className="mt-4 px-3 py-1.5 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </>
        ) : (
          <>
            <XCircle size={28} strokeWidth={1.75} className="mx-auto text-rose-400" />
            <p className="text-[13px] font-medium mt-3">Import failed</p>
            <button
              onClick={onDone}
              className="mt-4 px-3 py-1.5 rounded-md text-[13px] text-subtle hover:bg-muted hover:text-foreground transition-colors"
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
