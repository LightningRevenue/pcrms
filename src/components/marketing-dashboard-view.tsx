"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone, X, ArrowUpRight } from "lucide-react";
import {
  listCampaignPerformance,
  getCampaignMembers,
  type CampaignSummary,
  type CampaignMemberRow,
} from "@/lib/actions/campaign-performance-stats";
import { useContactHref } from "@/lib/view-mode";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-subtle",
  active: "bg-blue-500 text-white",
  sent: "bg-emerald-500 text-white",
};

export function MarketingDashboardView() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null);
  const [detail, setDetail] = useState<{ campaign: CampaignSummary; filter?: "opened" | "not-opened" | "failed" } | null>(null);

  useEffect(() => {
    listCampaignPerformance().then(setCampaigns);
  }, []);

  return (
    <div className="px-8 py-10 max-w-5xl">
      <h1 className="text-xl font-medium">Marketing Dashboard</h1>
      <p className="text-[13px] text-subtle mt-1">Open rates and send status across your campaigns.</p>

      <div className="mt-6 border border-border rounded-md overflow-hidden">
        <div className="grid grid-cols-[1fr_80px_80px_80px_90px] gap-3 px-4 py-2 border-b border-border text-[11px] font-medium text-subtle uppercase tracking-wide">
          <span>Campaign</span>
          <span className="text-right">Sent</span>
          <span className="text-right">Opened</span>
          <span className="text-right">Failed</span>
          <span className="text-right">Open rate</span>
        </div>
        {campaigns === null ? (
          <p className="text-[13px] text-subtle text-center py-8">Loading…</p>
        ) : campaigns.length === 0 ? (
          <p className="text-[13px] text-subtle text-center py-8">
            No campaigns yet —{" "}
            <Link href="/marketing/campaigns" className="text-accent hover:underline">
              create one
            </Link>
            .
          </p>
        ) : (
          campaigns.map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-[1fr_80px_80px_80px_90px] gap-3 px-4 py-2.5 items-center text-[13px] border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Megaphone size={13} strokeWidth={1.75} className="text-subtle shrink-0" />
                <Link href={`/marketing/campaigns/${c.id}`} className="truncate hover:underline">
                  {c.name}
                </Link>
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[c.status] ?? "bg-muted text-subtle"}`}>
                  {c.status}
                </span>
              </span>
              <button
                onClick={() => setDetail({ campaign: c })}
                disabled={c.sentCount === 0}
                className="text-right tabular-nums hover:text-accent transition-colors disabled:hover:text-foreground disabled:cursor-default"
              >
                {c.sentCount}
              </button>
              <button
                onClick={() => setDetail({ campaign: c, filter: "opened" })}
                disabled={c.openedCount === 0}
                className="text-right tabular-nums text-emerald-400 hover:opacity-70 transition-opacity disabled:hover:opacity-100 disabled:cursor-default"
              >
                {c.openedCount}
              </button>
              <button
                onClick={() => setDetail({ campaign: c, filter: "failed" })}
                disabled={c.failedCount === 0}
                className="text-right tabular-nums text-red-400 hover:opacity-70 transition-opacity disabled:hover:opacity-100 disabled:cursor-default"
              >
                {c.failedCount}
              </button>
              <span className="text-right tabular-nums text-subtle">{c.openRatePct !== null ? `${c.openRatePct}%` : "–"}</span>
            </div>
          ))
        )}
      </div>

      {detail && (
        <CampaignMembersPanel
          campaign={detail.campaign}
          filter={detail.filter}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function CampaignMembersPanel({
  campaign,
  filter,
  onClose,
}: {
  campaign: CampaignSummary;
  filter?: "opened" | "not-opened" | "failed";
  onClose: () => void;
}) {
  const [rows, setRows] = useState<CampaignMemberRow[] | null>(null);
  const contactHref = useContactHref();

  useEffect(() => {
    getCampaignMembers(campaign.id, filter).then(setRows);
  }, [campaign.id, filter]);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-screen w-96 bg-surface border-l border-border z-50 flex flex-col shadow-xl">
        <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-border">
          <div>
            <p className="text-[13px] font-medium truncate">{campaign.name}</p>
            <p className="text-[11px] text-subtle">{filter === "opened" ? "Opened" : filter === "failed" ? "Failed" : "Sent"}</p>
          </div>
          <button onClick={onClose} className="text-subtle hover:text-foreground transition-colors">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {rows === null ? (
            <p className="text-[13px] text-subtle text-center py-10">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-[13px] text-subtle text-center py-10">Nothing here.</p>
          ) : (
            <div className="divide-y divide-border">
              {rows.map((r) => (
                <Link
                  key={r.id}
                  href={contactHref(r.personId)}
                  className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-muted/40 transition-colors group"
                >
                  <span className="text-[13px] truncate">{r.personName}</span>
                  <span className="flex items-center gap-2 shrink-0 text-[12px] text-subtle">
                    {r.opened && <span className="text-emerald-400">{r.openCount} open{r.openCount === 1 ? "" : "s"}</span>}
                    <ArrowUpRight size={12} strokeWidth={1.75} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
