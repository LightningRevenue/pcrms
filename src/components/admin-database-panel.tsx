"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Database, Download, Play, ShieldAlert } from "lucide-react";
import { saveS3Config, triggerBackupNow, listBackups } from "@/lib/actions/admin-database";

type DatabaseStatus = Awaited<ReturnType<typeof import("@/lib/actions/admin-database").getDatabaseStatus>>;
type S3ConfigView = Awaited<ReturnType<typeof import("@/lib/actions/admin-database").getS3Config>>;
type Backups = Awaited<ReturnType<typeof listBackups>>;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date) {
  return new Date(date).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function AdminDatabasePanel({
  status,
  initialS3Config,
  initialBackups,
}: {
  status: DatabaseStatus;
  initialS3Config: S3ConfigView;
  initialBackups: Backups;
}) {
  const [backups, setBackups] = useState(initialBackups);
  const [pending, startTransition] = useTransition();
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  function refreshBackups() {
    startTransition(async () => {
      setBackups(await listBackups());
    });
  }

  function handleBackupNow() {
    setBackupError(null);
    setBackupMessage(null);
    startTransition(async () => {
      try {
        const result = await triggerBackupNow();
        setBackupMessage(
          `Backup created: ${result.filename} (${formatBytes(result.sizeBytes)})${result.uploadedToS3 ? ", uploaded to S3" : ", S3 not configured — kept locally only"}`
        );
        setBackups(await listBackups());
      } catch (err) {
        setBackupError(err instanceof Error ? err.message : "Backup failed");
      }
    });
  }

  return (
    <div className="mt-6 space-y-8">
      <section>
        <p className="text-[12px] font-medium text-subtle uppercase tracking-wide">Status</p>
        <div className="mt-2 border border-border rounded-md divide-y divide-border">
          <div className="flex items-center justify-between px-3 py-2.5 text-[13px]">
            <span className="flex items-center gap-2 text-subtle">
              <Database size={14} strokeWidth={1.75} />
              Postgres
            </span>
            <span className="text-right">
              {status.version} · {status.sizePretty}
            </span>
          </div>
          <StatusRow
            label="Postgres password"
            ok={!status.usingDefaultPassword}
            okText="Custom password set"
            badText="Still using the default crm/crm password — rotate it (see DEPLOY.md)"
          />
          <StatusRow
            label="Redis password"
            ok={status.redisHasPassword}
            okText="Password set"
            badText="No password set — Redis is open to anything that can reach the port"
          />
        </div>
      </section>

      <S3ConfigForm initial={initialS3Config} />

      <section>
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-medium text-subtle uppercase tracking-wide">Backups</p>
          <button
            onClick={handleBackupNow}
            disabled={pending}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Play size={13} strokeWidth={1.75} />
            {pending ? "Working…" : "Run backup now"}
          </button>
        </div>

        {backupMessage && <p className="text-[12px] text-emerald-400 mt-2">{backupMessage}</p>}
        {backupError && <p className="text-[12px] text-red-400 mt-2">{backupError}</p>}

        <p className="text-[12px] text-subtle mt-3 mb-1.5">Local dumps (kept 7 days)</p>
        <div className="border border-border rounded-md overflow-hidden">
          {backups.local.length === 0 ? (
            <div className="px-3 py-4 text-[13px] text-subtle text-center">No local backups yet</div>
          ) : (
            backups.local.map((b) => (
              <div
                key={b.filename}
                className="flex items-center justify-between px-3 py-2 text-[13px] border-b border-border last:border-b-0"
              >
                <span className="truncate">{b.filename}</span>
                <span className="flex items-center gap-3 text-subtle shrink-0">
                  <span>{formatBytes(b.sizeBytes)}</span>
                  <span>{formatDate(b.createdAt)}</span>
                  <a
                    href={`/api/admin/database/backups/${b.filename}`}
                    className="flex items-center gap-1 text-accent hover:underline"
                  >
                    <Download size={12} strokeWidth={1.75} />
                    Download
                  </a>
                </span>
              </div>
            ))
          )}
        </div>

        <p className="text-[12px] text-subtle mt-4 mb-1.5">Recent runs</p>
        <div className="border border-border rounded-md overflow-hidden">
          {backups.runs.length === 0 ? (
            <div className="px-3 py-4 text-[13px] text-subtle text-center">No backup runs logged yet</div>
          ) : (
            backups.runs.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between px-3 py-2 text-[13px] border-b border-border last:border-b-0"
              >
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${
                    r.status === "success"
                      ? "bg-emerald-500 text-white"
                      : r.status === "error"
                        ? "bg-red-500 text-white"
                        : "bg-muted text-subtle"
                  }`}
                >
                  {r.status}
                </span>
                <span className="text-subtle flex-1 min-w-0 truncate px-2">{r.error ?? (r.emailsFound ? `${r.emailsFound} KB` : "")}</span>
                <span className="text-subtle shrink-0">{formatDate(r.startedAt)}</span>
              </div>
            ))
          )}
        </div>

        <button
          onClick={refreshBackups}
          disabled={pending}
          className="text-[12px] text-subtle hover:text-foreground transition-colors mt-2 disabled:opacity-50"
        >
          Refresh
        </button>
      </section>
    </div>
  );
}

function StatusRow({ label, ok, okText, badText }: { label: string; ok: boolean; okText: string; badText: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 text-[13px]">
      <span className="flex items-center gap-2 text-subtle">
        {ok ? (
          <CheckCircle2 size={14} strokeWidth={1.75} className="text-emerald-400" />
        ) : (
          <ShieldAlert size={14} strokeWidth={1.75} className="text-amber-400" />
        )}
        {label}
      </span>
      <span className={`text-right max-w-md ${ok ? "text-subtle" : "text-amber-400"}`}>{ok ? okText : badText}</span>
    </div>
  );
}

function S3ConfigForm({ initial }: { initial: S3ConfigView }) {
  const [bucket, setBucket] = useState(initial?.bucket ?? "");
  const [region, setRegion] = useState(initial?.region ?? "");
  const [accessKeyId, setAccessKeyId] = useState(initial?.accessKeyId ?? "");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await saveS3Config({ bucket, region, accessKeyId, secretAccessKey });
        setSecretAccessKey("");
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <section>
      <p className="text-[12px] font-medium text-subtle uppercase tracking-wide">S3 backup destination</p>
      <p className="text-[12px] text-subtle mt-1">
        {initial
          ? "Configured — backups upload here in addition to the local copy kept on this server."
          : "Not configured — backups are only kept locally on this server until you set this up."}
      </p>

      {!initial && (
        <p className="flex items-start gap-1.5 text-[12px] text-amber-400 mt-2">
          <AlertTriangle size={13} strokeWidth={1.75} className="shrink-0 mt-0.5" />
          Without S3, losing this EC2 instance loses your backups too.
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[12px] text-subtle">Bucket name</span>
          <input
            value={bucket}
            onChange={(e) => setBucket(e.target.value)}
            placeholder="my-crm-backups"
            className="mt-1 w-full px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent focus:border-accent transition-colors"
          />
        </label>
        <label className="block">
          <span className="text-[12px] text-subtle">Region</span>
          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="eu-central-1"
            className="mt-1 w-full px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent focus:border-accent transition-colors"
          />
        </label>
        <label className="block">
          <span className="text-[12px] text-subtle">Access key ID</span>
          <input
            value={accessKeyId}
            onChange={(e) => setAccessKeyId(e.target.value)}
            placeholder="AKIA..."
            className="mt-1 w-full px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent focus:border-accent transition-colors"
          />
        </label>
        <label className="block">
          <span className="text-[12px] text-subtle">Secret access key</span>
          <input
            type="password"
            value={secretAccessKey}
            onChange={(e) => setSecretAccessKey(e.target.value)}
            placeholder={initial ? "Leave blank to keep the current secret" : "Required"}
            className="mt-1 w-full px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent focus:border-accent transition-colors"
          />
        </label>
      </div>

      {error && <p className="text-[12px] text-red-400 mt-2">{error}</p>}
      {saved && <p className="text-[12px] text-emerald-400 mt-2">Saved.</p>}

      <button
        onClick={handleSave}
        disabled={pending}
        className="mt-3 px-3 py-1.5 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save S3 settings"}
      </button>
    </section>
  );
}
