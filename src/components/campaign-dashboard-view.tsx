"use client";

import { useEffect, useState } from "react";
import { Megaphone, CheckCircle2, Clock, XCircle, Loader2, Inbox, GitBranch, MailOpen } from "lucide-react";
import { getCampaignProgress, type CampaignProgress } from "@/lib/actions/campaigns";

type Campaign = {
  id: string;
  name: string;
  status: string;
  steps: { id: string }[];
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

export function CampaignDashboardView({ campaign }: { campaign: Campaign }) {
  const [progress, setProgress] = useState<CampaignProgress | null>(null);

  useEffect(() => {
    getCampaignProgress(campaign.id).then(setProgress);
    // Reactive campaigns can pick up new recipients and outstanding steps at any time, so
    // keep polling even once a campaign reads "sent" — it can flip back to "active".
    const interval = setInterval(() => {
      getCampaignProgress(campaign.id).then(setProgress);
    }, 15_000);
    return () => clearInterval(interval);
  }, [campaign.id]);

  const firstStep = progress?.bySteps[0];
  const step1Pct = firstStep && firstStep.pending + firstStep.sent + firstStep.failed + firstStep.skipped > 0
    ? Math.round(((firstStep.sent + firstStep.failed + firstStep.skipped) / (firstStep.pending + firstStep.sent + firstStep.failed + firstStep.skipped)) * 100)
    : 0;

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
          <GitBranch size={13} strokeWidth={1.5} />
          {campaign.steps.length} step{campaign.steps.length === 1 ? "" : "s"}
        </span>
        <span className="flex items-center gap-1.5 text-[12px] text-subtle">
          <Inbox size={13} strokeWidth={1.5} />
          {campaign.mailboxes.map((m) => m.mailboxAccount.label).join(", ") || "No inboxes"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full px-6 py-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-accent transition-[width] duration-500 ease-out"
                style={{ width: `${step1Pct}%` }}
              />
            </div>
            <span className="text-[12px] text-subtle tabular-nums shrink-0">{step1Pct}% step 1 done</span>
          </div>

          {!progress ? (
            <p className="text-[13px] text-subtle text-center py-8">Loading…</p>
          ) : (
            <>
              <div className="grid grid-cols-5 gap-3 mt-5">
                <StatTile icon={CheckCircle2} label="Sent" value={progress.bySteps.reduce((s, x) => s + x.sent, 0)} accent="text-accent" />
                <StatTile icon={MailOpen} label="Opened" value={progress.opened} accent="text-emerald-400" />
                <StatTile icon={Clock} label="In queue" value={progress.bySteps.reduce((s, x) => s + x.pending, 0)} accent="text-subtle" />
                <StatTile icon={XCircle} label="Failed" value={progress.bySteps.reduce((s, x) => s + x.failed, 0)} accent="text-red-400" />
                <StatTile icon={Loader2} label="Total" value={progress.total} accent="text-subtle" />
              </div>

              {progress.bySteps.length > 1 && (
                <div className="mt-6">
                  <p className="text-[12px] font-medium text-subtle uppercase tracking-wide mb-2">By step</p>
                  <div className="border border-border rounded-md overflow-hidden">
                    <div className="grid grid-cols-[1fr_80px_70px_70px_70px] gap-3 px-3 py-2 border-b border-border text-[11px] font-medium text-subtle">
                      <span>Step</span>
                      <span className="text-right">Sent</span>
                      <span className="text-right">Pending</span>
                      <span className="text-right">Failed</span>
                      <span className="text-right">Skipped</span>
                    </div>
                    {progress.bySteps.map((s) => (
                      <div key={s.stepId} className="grid grid-cols-[1fr_80px_70px_70px_70px] gap-3 px-3 py-2 items-center text-[13px] border-b border-border last:border-b-0">
                        <span>
                          Step {s.order + 1} <span className="text-subtle">· {s.delayLabel}</span>
                        </span>
                        <span className="text-right tabular-nums">{s.sent}</span>
                        <span className="text-right tabular-nums">{s.pending}</span>
                        <span className="text-right tabular-nums">{s.failed}</span>
                        <span className="text-right tabular-nums">{s.skipped}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {progress.byVariant.length > 1 && (
                <div className="mt-6">
                  <p className="text-[12px] font-medium text-subtle uppercase tracking-wide mb-2">By variant</p>
                  <div className="border border-border rounded-md overflow-hidden">
                    <div className="grid grid-cols-[1fr_80px_70px_70px] gap-3 px-3 py-2 border-b border-border text-[11px] font-medium text-subtle">
                      <span>Variant</span>
                      <span className="text-right">Members</span>
                      <span className="text-right">Sent</span>
                      <span className="text-right">Opened</span>
                    </div>
                    {progress.byVariant.map((v) => (
                      <div key={v.variantId} className="grid grid-cols-[1fr_80px_70px_70px] gap-3 px-3 py-2 items-center text-[13px] border-b border-border last:border-b-0">
                        <span className="truncate">{v.name}</span>
                        <span className="text-right tabular-nums">{v.memberCount}</span>
                        <span className="text-right tabular-nums">{v.sent}</span>
                        <span className="text-right tabular-nums">{v.opened}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6">
                <p className="text-[12px] font-medium text-subtle uppercase tracking-wide mb-2">Recipients</p>
                <div className="border border-border rounded-md divide-y divide-border">
                  {progress.members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
                      <span className="flex-1 min-w-0">
                        <p className="truncate">{m.name}</p>
                        <p className="text-[12px] text-subtle truncate">{m.email}</p>
                      </span>
                      {m.variantName && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-subtle shrink-0">{m.variantName}</span>
                      )}
                      {m.currentStep && (
                        <span className="text-[12px] text-subtle shrink-0">
                          Step {m.currentStep.order} of {m.currentStep.total}
                        </span>
                      )}
                      {m.opened && (
                        <span className="text-[12px] text-emerald-400 shrink-0 flex items-center gap-1">
                          <MailOpen size={12} strokeWidth={1.75} />
                          {m.openedAt ? relativeTime(m.openedAt) : "Opened"}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="border border-border rounded-md p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-subtle">
        <Icon size={12} strokeWidth={1.75} className={accent} />
        {label}
      </div>
      <p className="text-[18px] font-medium mt-1 tabular-nums">{value}</p>
    </div>
  );
}
