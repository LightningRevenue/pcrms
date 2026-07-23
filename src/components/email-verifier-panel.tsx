"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Search, ShieldCheck, ShieldX, ShieldAlert, Loader2, Trash2, X } from "lucide-react";
import {
  searchPeopleForVerification,
  verifyPeopleBatch,
  verifyAllUnverified,
  getBatchProgress,
  getVerificationLimit,
  getPeopleByStatus,
  deletePeopleByIds,
  type VerifierPerson,
} from "@/lib/actions/email-verify";

function Checkbox({ checked, disabled }: { checked: boolean; disabled?: boolean }) {
  return (
    <span
      className={`size-4 shrink-0 rounded border flex items-center justify-center ${
        checked ? "bg-accent border-accent" : "border-border"
      } ${disabled ? "opacity-50" : ""}`}
    >
      {checked && <Check size={12} strokeWidth={2.5} className="text-white" />}
    </span>
  );
}

function statusBadge(status: string | null, reason: string | null) {
  if (status === "valid")
    return <span title={reason ?? undefined} className="flex items-center gap-1 text-[12px] text-green-600"><ShieldCheck size={13} strokeWidth={1.75} /> Valid</span>;
  if (status === "invalid")
    return <span title={reason ?? undefined} className="flex items-center gap-1 text-[12px] text-red-600"><ShieldX size={13} strokeWidth={1.75} /> Invalid</span>;
  if (status === "catch-all")
    return <span title={reason ?? undefined} className="flex items-center gap-1 text-[12px] text-amber-500"><ShieldAlert size={13} strokeWidth={1.75} /> Catch-all</span>;
  return <span className="text-[12px] text-subtle">Not checked</span>;
}

type Progress = { total: number; done: number; valid: number; invalid: number; catchAll: number; finished: boolean };
type Limit = { allowed: boolean; current: number; limit: number | null };

function CleanupModal({ onClose, onDeleted }: { onClose: () => void; onDeleted: () => void }) {
  const [wantInvalid, setWantInvalid] = useState(true);
  const [wantCatchAll, setWantCatchAll] = useState(false);
  const [preview, setPreview] = useState<VerifierPerson[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const statuses: ("invalid" | "catch-all")[] = [
      ...(wantInvalid ? (["invalid"] as const) : []),
      ...(wantCatchAll ? (["catch-all"] as const) : []),
    ];
    if (!statuses.length) return setPreview([]);
    getPeopleByStatus(statuses).then(setPreview);
  }, [wantInvalid, wantCatchAll]);

  function runDelete() {
    startTransition(async () => {
      await deletePeopleByIds(preview.map((p) => p.id));
      onDeleted();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-[14px] font-medium">Clean up contacts</p>
          <button onClick={onClose} className="text-subtle hover:text-foreground">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-4 py-3 space-y-2 border-b border-border">
          <label className="flex items-center gap-2 text-[13px] cursor-pointer">
            <input type="checkbox" checked={wantInvalid} onChange={(e) => setWantInvalid(e.target.checked)} />
            All Invalid
          </label>
          <label className="flex items-center gap-2 text-[13px] cursor-pointer">
            <input type="checkbox" checked={wantCatchAll} onChange={(e) => setWantCatchAll(e.target.checked)} />
            All Catch-all
          </label>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {preview.map((p) => (
            <div key={p.id} className="px-4 py-2">
              <p className="text-[13px] truncate">{p.name || p.email}</p>
              <p className="text-[12px] text-subtle truncate">{p.email} — {p.emailVerifiedReason ?? p.emailVerifiedStatus}</p>
            </div>
          ))}
          {preview.length === 0 && <p className="px-4 py-6 text-center text-[13px] text-subtle">Nothing matches</p>}
        </div>

        <div className="px-4 py-3 border-t border-border">
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              disabled={preview.length === 0}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium bg-red-600 text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Trash2 size={13} strokeWidth={1.75} />
              Delete {preview.length} contact{preview.length === 1 ? "" : "s"}…
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-[13px] text-red-600">
                This permanently deletes {preview.length} contact{preview.length === 1 ? "" : "s"} — this cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={runDelete}
                  disabled={pending}
                  className="flex-1 px-3 py-1.5 rounded-md text-[13px] font-medium bg-red-600 text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {pending ? "Deleting…" : "Yes, delete permanently"}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  disabled={pending}
                  className="px-3 py-1.5 rounded-md text-[13px] border border-border hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmailVerifierPanel() {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<VerifierPerson[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchId, setBatchId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [limit, setLimit] = useState<Limit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCleanup, setShowCleanup] = useState(false);
  const [pending, startTransition] = useTransition();

  function refresh() {
    searchPeopleForVerification(query).then(setPeople);
    getVerificationLimit().then(setLimit);
  }

  useEffect(() => {
    searchPeopleForVerification(query).then(setPeople);
  }, [query]);

  useEffect(() => {
    getVerificationLimit().then(setLimit);
  }, []);

  // Poll fast — checks are sub-second each, a slow poll would make the bar feel laggy.
  useEffect(() => {
    if (!batchId) return;
    const interval = setInterval(async () => {
      const p = await getBatchProgress(batchId);
      if (!p) return;
      setProgress(p);
      if (p.finished) {
        clearInterval(interval);
        setBatchId(null);
        refresh();
      }
    }, 400);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === people.length ? new Set() : new Set(people.map((p) => p.id))));
  }

  function runSelected() {
    setError(null);
    startTransition(async () => {
      try {
        const id = await verifyPeopleBatch(Array.from(selected));
        setSelected(new Set());
        setProgress({ total: selected.size, done: 0, valid: 0, invalid: 0, catchAll: 0, finished: false });
        setBatchId(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to start verification");
      }
    });
  }

  function runAll() {
    setError(null);
    startTransition(async () => {
      try {
        const id = await verifyAllUnverified();
        setProgress({ total: 0, done: 0, valid: 0, invalid: 0, catchAll: 0, finished: false });
        setBatchId(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to start verification");
      }
    });
  }

  const running = !!batchId;
  const pct = progress && progress.total > 0 ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0;

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={runAll}
          disabled={running || pending}
          className="px-3 py-1.5 rounded-md text-[13px] font-medium bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {running ? "Verifying…" : "Verify All Unverified"}
        </button>
        <button
          onClick={runSelected}
          disabled={running || pending || selected.size === 0}
          className="px-3 py-1.5 rounded-md text-[13px] border border-border hover:bg-muted transition-colors disabled:opacity-50"
        >
          Verify Selected ({selected.size})
        </button>
        <button
          onClick={() => setShowCleanup(true)}
          disabled={running}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] border border-border text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          <Trash2 size={13} strokeWidth={1.75} />
          Clean up…
        </button>
      </div>

      {showCleanup && <CleanupModal onClose={() => setShowCleanup(false)} onDeleted={refresh} />}

      {error && <p className="text-[13px] text-red-600">{error}</p>}

      {progress && (
        <div className="border border-border rounded-md p-3">
          <div className="flex items-center justify-between text-[12px] text-subtle mb-1.5">
            <span className="flex items-center gap-1.5">
              {!progress.finished && <Loader2 size={13} strokeWidth={2} className="animate-spin" />}
              {progress.finished ? "Done" : "Verifying"} {progress.done}
              {progress.total > 0 ? ` / ${progress.total}` : ""}
            </span>
            <span>
              <span className="text-green-600">{progress.valid} valid</span>
              {" · "}
              <span className="text-amber-500">{progress.catchAll} catch-all</span>
              {" · "}
              <span className="text-red-600">{progress.invalid} invalid</span>
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress.total > 0 ? pct : 100}%` }} />
          </div>
        </div>
      )}

      <div className="relative">
        <Search size={14} strokeWidth={1.75} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search contacts by name or email…"
          className="w-full pl-8 pr-3 py-1.5 rounded-md border border-border text-[13px] outline-none focus:border-accent transition-colors"
        />
      </div>

      <div className="border border-border rounded-md overflow-hidden">
        <div
          onClick={toggleAll}
          className="flex items-center gap-2.5 px-3 py-1.5 bg-muted/50 cursor-pointer text-[12px] text-subtle"
        >
          <Checkbox checked={people.length > 0 && selected.size === people.length} />
          Select all ({people.length})
        </div>
        <div className="max-h-96 overflow-y-auto divide-y divide-border">
          {people.map((p) => (
            <div
              key={p.id}
              onClick={() => toggle(p.id)}
              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted transition-colors"
            >
              <Checkbox checked={selected.has(p.id)} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] truncate">{p.name || p.email}</p>
                <p className="text-[12px] text-subtle truncate">{p.email}</p>
              </div>
              {statusBadge(p.emailVerifiedStatus, p.emailVerifiedReason)}
            </div>
          ))}
          {people.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-subtle">No contacts found</p>}
        </div>
      </div>

      {limit && (
        <div className="border border-border rounded-md p-3">
          <p className="text-[12px] text-subtle">Limits</p>
          <p className="text-[16px] font-medium mt-0.5">
            {limit.current}
            {limit.limit !== null && <span className="text-subtle font-normal"> / {limit.limit} verifications this month</span>}
            {limit.limit === null && <span className="text-subtle font-normal"> verifications this month</span>}
          </p>
          {limit.limit !== null && (
            <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${limit.current / limit.limit >= 0.9 ? "bg-red-500" : "bg-accent"}`}
                style={{ width: `${Math.min(100, Math.round((limit.current / limit.limit) * 100))}%` }}
              />
            </div>
          )}
          {!limit.allowed && (
            <p className="text-[12px] text-red-600 mt-1.5">Monthly verification limit reached — upgrade your plan to verify more.</p>
          )}
        </div>
      )}
    </div>
  );
}
