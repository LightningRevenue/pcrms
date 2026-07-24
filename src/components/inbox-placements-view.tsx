"use client";

import { useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import { listInboxPlacements, type InboxPlacementRow } from "@/lib/actions/inbox-placement-stats";

function ratePct(value: number | null, colorClass: string) {
  if (value === null) return <span className="text-subtle">–</span>;
  return <span className={colorClass}>{value}%</span>;
}

export function InboxPlacementsView() {
  const [rows, setRows] = useState<InboxPlacementRow[] | null>(null);

  useEffect(() => {
    listInboxPlacements().then(setRows);
  }, []);

  return (
    <div className="px-8 py-10 max-w-5xl">
      <h1 className="text-xl font-medium">Inbox Placements</h1>
      <p className="text-[13px] text-subtle mt-1">
        Send volume and engagement per outreach inbox. Failure rate reflects send-time SMTP
        errors, not asynchronous bounce-backs.
      </p>

      <div className="mt-6 border border-border rounded-md overflow-hidden">
        <div className="grid grid-cols-[1fr_70px_70px_80px_80px_90px_110px] gap-3 px-4 py-2 border-b border-border text-[11px] font-medium text-subtle uppercase tracking-wide">
          <span>Inbox</span>
          <span className="text-right">Today</span>
          <span className="text-right">Week</span>
          <span className="text-right">Month</span>
          <span className="text-right">Reply</span>
          <span className="text-right">Failure</span>
          <span className="text-right">Unsubscribe</span>
        </div>
        {rows === null ? (
          <p className="text-[13px] text-subtle text-center py-8">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-[13px] text-subtle text-center py-8">
            No outreach inboxes yet — add one under Settings &gt; Outreach Inboxes.
          </p>
        ) : (
          rows.map((r) => (
            <div
              key={r.mailboxAccountId}
              className="grid grid-cols-[1fr_70px_70px_80px_80px_90px_110px] gap-3 px-4 py-2.5 items-center text-[13px] border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Inbox size={13} strokeWidth={1.75} className="text-subtle shrink-0" />
                <span className="truncate">{r.label}</span>
                <span className="text-subtle truncate text-[12px]">{r.email}</span>
              </span>
              <span className="text-right tabular-nums">{r.sentToday}</span>
              <span className="text-right tabular-nums">{r.sentThisWeek}</span>
              <span className="text-right tabular-nums">{r.sentThisMonth}</span>
              <span className="text-right tabular-nums">{ratePct(r.replyRatePct, "text-emerald-400")}</span>
              <span className="text-right tabular-nums">{ratePct(r.failureRatePct, "text-red-400")}</span>
              <span className="text-right tabular-nums">{ratePct(r.unsubscribeRatePct, "text-amber-400")}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
