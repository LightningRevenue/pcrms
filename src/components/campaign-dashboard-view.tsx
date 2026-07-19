"use client";

import { useEffect, useState } from "react";
import { Megaphone, CheckCircle2, Clock, XCircle, Loader2, Inbox, FileText, MailOpen } from "lucide-react";
import { getCampaignProgress, type CampaignProgress } from "@/lib/actions/campaigns";

type Campaign = {
  id: string;
  name: string;
  status: string;
  template: { name: string } | null;
  mailboxes: { mailboxAccount: { label: string } }[];
};

function relativeTime(date: Date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const STATUS_META: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  sent: { label: "Sent", icon: CheckCircle2, className: "text-accent" },
  queued: { label: "Queued", icon: Clock, className: "text-subtle" },
  pending: { label: "Pending", icon: Clock, className: "text-subtle" },
  failed: { label: "Failed", icon: XCircle, className: "text-red-400" },
};

export function CampaignDashboardView({ campaign }: { campaign: Campaign }) {
  const [progress, setProgress] = useState<CampaignProgress | null>(null);

  useEffect(() => {
    getCampaignProgress(campaign.id).then(setProgress);
    // Sends trickle out 30-60s apart in the background — poll gently so the dashboard
    // reflects them without the user needing to refresh manually.
    const interval = setInterval(() => {
      getCampaignProgress(campaign.id).then(setProgress);
    }, 15_000);
    return () => clearInterval(interval);
  }, [campaign.id]);

  const inFlight = progress ? progress.pending + progress.queued : 0;
  const done = progress ? progress.sent + progress.failed : 0;
  const pct = progress && progress.total > 0 ? Math.round((done / progress.total) * 100) : 0;

  return (
    <div className="flex flex-col h-screen">
      <div className="h-12 shrink-0 flex items-center gap-2 px-6 border-b border-border">
        <Megaphone size={14} strokeWidth={1.5} className="text-subtle" />
        <span className="text-[13px] font-medium">{campaign.name}</span>
        <span
          className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium capitalize ${
            campaign.status === "active"
              ? "bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-accent"
              : "bg-muted text-subtle"
          }`}
        >
          {campaign.status === "active" ? "Sending" : campaign.status}
        </span>
        <div className="flex-1" />
        <span className="flex items-center gap-1.5 text-[12px] text-subtle">
          <FileText size={13} strokeWidth={1.5} />
          {campaign.template?.name ?? "No template"}
        </span>
        <span className="flex items-center gap-1.5 text-[12px] text-subtle">
          <Inbox size={13} strokeWidth={1.5} />
          {campaign.mailboxes.map((m) => m.mailboxAccount.label).join(", ") || "No inboxes"}
        </span>
      </div>

      <div className="max-w-3xl mx-auto w-full px-6 py-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-accent transition-[width] duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[12px] text-subtle shrink-0 w-10 text-right">{pct}%</span>
        </div>
        {campaign.status === "active" && (
          <p className="text-[12px] text-subtle flex items-center gap-1.5">
            <Loader2 size={12} strokeWidth={2} className="animate-spin" />
            Sending gradually, 30–60s apart between emails. This page updates automatically.
          </p>
        )}

        <div className="grid grid-cols-5 gap-3 mt-5">
          <StatTile label="Sent" value={progress?.sent} className="text-accent" />
          <StatTile
            label="Opened"
            value={progress?.opened}
            suffix={progress && progress.sent > 0 ? `${Math.round((progress.opened / progress.sent) * 100)}%` : undefined}
            className="text-accent"
          />
          <StatTile label="In queue" value={progress ? inFlight : undefined} className="text-subtle" />
          <StatTile label="Failed" value={progress?.failed} className="text-red-400" />
          <StatTile label="Total" value={progress?.total} className="text-foreground" />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto border-t border-border">
        <div className="max-w-3xl mx-auto w-full">
          {!progress ? (
            <p className="text-[13px] text-subtle text-center py-8">Loading…</p>
          ) : (
            <div className="divide-y divide-border">
              {progress.members.map((m) => {
                const meta = STATUS_META[m.sendStatus] ?? STATUS_META.pending;
                const Icon = meta.icon;
                return (
                  <div key={m.id} className="flex items-center gap-3 px-6 py-2.5">
                    <Icon size={15} strokeWidth={1.75} className={`shrink-0 ${meta.className}`} />
                    <span className="flex-1 min-w-0">
                      <p className="text-[13px] truncate">{m.name}</p>
                      {m.email && <p className="text-[12px] text-subtle truncate">{m.email}</p>}
                    </span>
                    {m.opened && (
                      <span
                        className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-accent shrink-0"
                        title={m.openedAt ? `Opened ${relativeTime(m.openedAt)}` : "Opened"}
                      >
                        <MailOpen size={11} strokeWidth={2} />
                        Opened
                      </span>
                    )}
                    {m.sendStatus === "failed" && m.sendError ? (
                      <span className="text-[12px] text-red-400 shrink-0 max-w-xs truncate" title={m.sendError}>
                        {m.sendError}
                      </span>
                    ) : (
                      <span className={`text-[12px] shrink-0 ${meta.className}`}>
                        {m.sentAt ? relativeTime(m.sentAt) : meta.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  suffix,
  className,
}: {
  label: string;
  value: number | undefined;
  suffix?: string;
  className: string;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-[11px] text-subtle uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-semibold mt-1 ${className}`}>
        {value ?? "–"}
        {suffix && <span className="text-[12px] text-subtle font-normal ml-1">({suffix})</span>}
      </p>
    </div>
  );
}
