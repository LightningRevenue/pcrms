"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Download, Trash2, Tag as TagIcon, Loader2, AlertCircle } from "lucide-react";
import {
  parseVerifyCsvPreview,
  startVerifyBatch,
  getVerifyBatch,
  downloadVerifyCsv,
  deleteVerifyBatch,
  updateVerifyBatchTags,
} from "@/lib/actions/verify-emails";
import type { DownloadKind } from "@/lib/verify-api";
import { VerifyMappingModal } from "@/components/verify-mapping-modal";

type BatchRow = {
  id: string;
  name: string;
  status: string;
  tags: string[];
  totalRows: number;
  checkedRows: number;
  validRows: number;
  invalidRows: number;
  catchAllRows: number;
  createdAt: Date;
};

type Preview = {
  headers: string[];
  preview: string[][];
  rowCount: number;
  suggestedColumn: string | null;
};

const GRID = "1fr 90px 90px 90px 110px 150px 92px";

function downloadFile(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function VerifyEmailsPanel({ initialBatches }: { initialBatches: BatchRow[] }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [batches, setBatches] = useState(initialBatches);
  const [pending, setPending] = useState<{ csvText: string; fileName: string; preview: Preview } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which finished batch is showing its download options.
  const [downloading, setDownloading] = useState<string | null>(null);

  const running = batches.some((b) => b.status === "pending" || b.status === "processing");

  // Poll only while something is actually in flight, and only for the rows that moved.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(async () => {
      const active = batches.filter((b) => b.status === "pending" || b.status === "processing");
      const updated = await Promise.all(active.map((b) => getVerifyBatch(b.id)));
      setBatches((prev) =>
        prev.map((b) => {
          const fresh = updated.find((u): u is NonNullable<typeof u> => u?.id === b.id);
          return fresh ? { ...b, ...fresh } : b;
        })
      );
    }, 1200);
    return () => clearInterval(timer);
  }, [running, batches]);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const csvText = await file.text();
      const preview = await parseVerifyCsvPreview(csvText);
      setPending({ csvText, fileName: file.name, preview });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that CSV");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function confirmStart(name: string, emailColumn: string, tags: string[]) {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await startVerifyBatch(name, pending.csvText, emailColumn, tags);
      setPending(null);
      router.refresh();
      // router.refresh() repaints the server component; pull the new row in immediately so the
      // progress poller has something to track without waiting a round trip.
      const { listVerifyBatches } = await import("@/lib/actions/verify-emails");
      setBatches(await listVerifyBatches());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start verification");
    } finally {
      setBusy(false);
    }
  }

  async function download(id: string, kind: DownloadKind) {
    setError(null);
    try {
      const { filename, csv } = await downloadVerifyCsv(id, kind);
      downloadFile(filename, csv);
      setDownloading(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}" and its results? This cannot be undone.`)) return;
    await deleteVerifyBatch(id);
    setBatches((prev) => prev.filter((b) => b.id !== id));
  }

  async function editTags(batch: BatchRow) {
    const next = prompt("Tags (comma separated)", batch.tags.join(", "));
    if (next === null) return;
    const tags = next.split(",").map((t) => t.trim()).filter(Boolean);
    await updateVerifyBatchTags(batch.id, tags);
    setBatches((prev) => prev.map((b) => (b.id === batch.id ? { ...b, tags } : b)));
  }

  return (
    <div className="mt-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onClick={() => fileInput.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 py-10 rounded-lg border border-dashed cursor-pointer transition-colors ${
          dragging ? "border-accent bg-accent/5" : "border-border hover:bg-muted/40"
        }`}
      >
        {busy && !pending ? (
          <Loader2 size={18} strokeWidth={1.75} className="text-subtle animate-spin" />
        ) : (
          <Upload size={18} strokeWidth={1.75} className="text-subtle" />
        )}
        <p className="text-[13px]">Drop a CSV here, or click to choose a file</p>
        <p className="text-[11px] text-subtle">You&apos;ll pick which column holds the email addresses next.</p>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-md bg-red-500/10 text-red-400 text-[12px]">
          <AlertCircle size={14} strokeWidth={1.75} className="shrink-0" />
          {error}
        </div>
      )}

      <h2 className="text-[13px] font-medium mt-8">Batches</h2>

      <div className="mt-2 border border-border rounded-md overflow-hidden">
        <div
          className="grid gap-3 px-3 py-2 border-b border-border text-[11px] font-medium text-subtle"
          style={{ gridTemplateColumns: GRID }}
        >
          <span>Name</span>
          <span>Valid</span>
          <span>Catch-all</span>
          <span>Invalid</span>
          <span>Status</span>
          <span>Created</span>
          <span />
        </div>

        {batches.map((b) => {
          const active = b.status === "pending" || b.status === "processing";
          const pct = b.totalRows > 0 ? Math.round((b.checkedRows / b.totalRows) * 100) : 0;
          return (
            <div key={b.id} className="border-b border-border last:border-b-0">
              <div className="grid gap-3 px-3 py-2.5 items-center text-[13px] group" style={{ gridTemplateColumns: GRID }}>
                <div className="min-w-0">
                  <p className="truncate font-medium">{b.name}</p>
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    {b.tags.map((t) => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-subtle">
                        {t}
                      </span>
                    ))}
                    <span className="text-[11px] text-subtle">{b.totalRows} rows</span>
                  </div>
                </div>
                <span className="text-emerald-500">{b.validRows}</span>
                <span className="text-amber-400">{b.catchAllRows}</span>
                <span className="text-subtle">{b.invalidRows}</span>
                <span>
                  {active ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-subtle">
                      <Loader2 size={12} strokeWidth={2} className="animate-spin" />
                      {pct}%
                    </span>
                  ) : b.status === "failed" ? (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">Failed</span>
                  ) : (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">Done</span>
                  )}
                </span>
                <span className="text-subtle text-[12px]">{new Date(b.createdAt).toLocaleDateString()}</span>
                <span className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => editTags(b)} title="Edit tags" className="text-subtle hover:text-foreground transition-colors">
                    <TagIcon size={14} strokeWidth={1.75} />
                  </button>
                  {b.status === "done" && (
                    <button
                      onClick={() => setDownloading(downloading === b.id ? null : b.id)}
                      title="Download"
                      className="text-subtle hover:text-foreground transition-colors"
                    >
                      <Download size={14} strokeWidth={1.75} />
                    </button>
                  )}
                  <button onClick={() => remove(b.id, b.name)} title="Delete" className="text-subtle hover:text-red-400 transition-colors">
                    <Trash2 size={14} strokeWidth={1.75} />
                  </button>
                </span>
              </div>

              {active && (
                <div className="h-0.5 bg-muted">
                  <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                </div>
              )}

              {downloading === b.id && (
                <div className="px-3 pb-3 flex flex-wrap items-center gap-2">
                  <span className="text-[12px] text-subtle">Download:</span>
                  <button
                    onClick={() => download(b.id, "valid")}
                    className="px-2.5 py-1 rounded-md text-[12px] bg-accent text-white hover:opacity-90 transition-opacity"
                  >
                    Fully verified only ({b.validRows})
                  </button>
                  <button
                    onClick={() => download(b.id, "valid-catch-all")}
                    className="px-2.5 py-1 rounded-md text-[12px] border border-border hover:bg-muted transition-colors"
                  >
                    Valid + catch-all ({b.validRows + b.catchAllRows})
                  </button>
                  <button
                    onClick={() => download(b.id, "invalid")}
                    className="px-2.5 py-1 rounded-md text-[12px] border border-border hover:bg-muted transition-colors"
                  >
                    Invalid ({b.invalidRows})
                  </button>
                  <button
                    onClick={() => download(b.id, "all")}
                    className="px-2.5 py-1 rounded-md text-[12px] border border-border hover:bg-muted transition-colors"
                  >
                    Everything
                  </button>
                </div>
              )}

              {b.status === "failed" && (
                <p className="px-3 pb-2 text-[11px] text-red-400">Verification failed — delete and re-upload to retry.</p>
              )}
            </div>
          );
        })}

        {batches.length === 0 && (
          <div className="px-3 py-6 text-[13px] text-subtle text-center">No batches yet</div>
        )}
      </div>

      {pending && (
        <VerifyMappingModal
          {...pending.preview}
          defaultName={pending.fileName.replace(/\.csv$/i, "")}
          busy={busy}
          onClose={() => setPending(null)}
          onConfirm={confirmStart}
        />
      )}
    </div>
  );
}
