"use client";

import Link from "next/link";
import type { OpportunityRow } from "@/components/opportunities-view";
import { ArrowUpRight, DollarSign, Target, Building2, User as UserIcon, CalendarDays } from "lucide-react";

const OUTCOME_BADGE: Record<string, string> = {
  open: "bg-blue-500 text-white",
  won: "bg-emerald-500 text-white",
  lost: "bg-rose-500 text-white",
};

function formatValue(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return `${value}`;
}

function contactName(p: { firstName: string; lastName: string | null } | null) {
  if (!p) return "";
  return [p.firstName, p.lastName].filter(Boolean).join(" ");
}

function formatCloseDate(date: Date | null) {
  if (!date) return "No close date";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

const GRID = "220px 100px 120px 160px 160px 180px 160px";

export function ListDealsView({ opportunities }: { opportunities: OpportunityRow[] }) {
  return (
    <div className="min-w-max">
      <div
        className="grid px-6 py-2 text-[12px] text-subtle border-b border-border sticky top-0 bg-background z-10"
        style={{ gridTemplateColumns: GRID }}
      >
        <span className="flex items-center gap-1.5 pl-1">
          <Target size={13} strokeWidth={1.75} />
          Name
        </span>
        <span className="flex items-center gap-1.5 pl-1">
          <DollarSign size={13} strokeWidth={1.75} />
          Value
        </span>
        <span className="pl-1">Stage</span>
        <span className="flex items-center gap-1.5 pl-1">
          <UserIcon size={13} strokeWidth={1.75} />
          Owner
        </span>
        <span className="flex items-center gap-1.5 pl-1">
          <Building2 size={13} strokeWidth={1.75} />
          Company
        </span>
        <span className="pl-1">Contact</span>
        <span className="flex items-center gap-1.5 pl-1">
          <CalendarDays size={13} strokeWidth={1.75} />
          Close date
        </span>
      </div>
      <div className="divide-y divide-border">
        {opportunities.map((o) => {
          const owner = o.owner?.name ?? o.owner?.email ?? "";
          return (
            <div key={o.id} className="grid px-6 py-2 items-center hover:bg-muted/40 transition-colors" style={{ gridTemplateColumns: GRID }}>
              <Link href={`/deals/${o.id}`} className="flex items-center gap-2 min-w-0 pl-1 group">
                <p className="text-[13px] leading-tight truncate px-2 py-0.5 rounded-md border border-border bg-muted group-hover:bg-muted/70 group-hover:border-subtle transition-colors">
                  {o.name || "Untitled"}
                </p>
                <ArrowUpRight size={13} strokeWidth={1.75} className="text-subtle opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </Link>
              <span className="text-[13px] text-subtle pl-1">{formatValue(o.value)}</span>
              <span className="pl-1">
                <span className={`px-2 py-0.5 rounded-full text-[12px] font-medium ${OUTCOME_BADGE[o.stage] ?? "bg-muted text-subtle"}`}>
                  {o.stage}
                </span>
              </span>
              <span className="text-[13px] text-subtle truncate pl-1 pr-2">{owner || "—"}</span>
              <span className="text-[13px] text-subtle truncate pl-1 pr-2">{o.company?.name || "—"}</span>
              <span className="text-[13px] text-subtle truncate pl-1 pr-2">{contactName(o.contact) || "—"}</span>
              <span className="text-[13px] text-subtle truncate pl-1 pr-2">{formatCloseDate(o.closeDate)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
