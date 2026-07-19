"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Company, Opportunity, PipelineStage, Person, User } from "@prisma/client";
import {
  KanbanSquare,
  ChevronDown,
  ListFilter,
  ArrowUpDown,
  SlidersHorizontal,
  Plus,
  DollarSign,
  Target,
  CalendarDays,
  Building2,
  User as UserIcon,
} from "lucide-react";
import { moveOpportunityStage } from "@/lib/actions/opportunities";

export type OpportunityStage = string;

export type OpportunityRow = Opportunity & {
  company: Company | null;
  contact: Person | null;
  owner: User | null;
  createdBy: User | null;
};

const OUTCOME_BADGE: Record<string, string> = {
  open: "bg-blue-500/15 text-blue-300",
  won: "bg-emerald-500/15 text-emerald-300",
  lost: "bg-rose-500/15 text-rose-300",
};

const AVATAR_COLORS = [
  "bg-rose-500/20 text-rose-300",
  "bg-blue-500/20 text-blue-300",
  "bg-emerald-500/20 text-emerald-300",
  "bg-amber-500/20 text-amber-300",
  "bg-violet-500/20 text-violet-300",
  "bg-cyan-500/20 text-cyan-300",
];

function avatarColor(name: string) {
  const code = name.charCodeAt(0) + name.charCodeAt(name.length - 1);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Avatar({ name }: { name: string }) {
  return (
    <div className={`size-4 shrink-0 rounded-full flex items-center justify-center text-[9px] font-medium ${avatarColor(name || "?")}`}>
      {initials(name) || "?"}
    </div>
  );
}

function formatValue(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return `${value}`;
}

function contactName(p: Pick<Person, "firstName" | "lastName"> | null) {
  if (!p) return "";
  return [p.firstName, p.lastName].filter(Boolean).join(" ");
}

function formatCloseDate(date: Date | null) {
  if (!date) return "No close date";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function OpportunitiesView({
  opportunities: initial,
  stages,
}: {
  opportunities: OpportunityRow[];
  stages: PipelineStage[];
}) {
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>(initial);
  const [, startTransition] = useTransition();
  const stageByLabel = new Map(stages.map((s) => [s.label, s]));

  function moveOpportunity(id: string, stage: OpportunityStage) {
    const target = stageByLabel.get(stage);
    const closeDate = target && target.outcome !== "open" ? new Date() : null;
    setOpportunities((prev) => prev.map((o) => (o.id === id ? { ...o, stage, closeDate } : o)));
    startTransition(() => moveOpportunityStage(id, stage));
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="h-12 shrink-0 flex items-center justify-between px-6 border-b border-border">
        <div className="flex items-center gap-1.5 text-[13px]">
          <Target size={14} strokeWidth={1.75} className="text-rose-400" />
          <span className="font-medium">Opportunities</span>
        </div>
      </div>

      <div className="h-11 shrink-0 flex items-center justify-between px-6 border-b border-border">
        <button className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors">
          <KanbanSquare size={14} strokeWidth={1.75} />
          By Stage
          <span className="text-subtle">· {opportunities.length}</span>
          <ChevronDown size={13} strokeWidth={1.75} />
        </button>

        <div className="flex items-center gap-1">
          <button className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[13px] text-subtle hover:bg-muted hover:text-foreground transition-colors">
            <ListFilter size={14} strokeWidth={1.75} />
            Filter
          </button>
          <button className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[13px] text-subtle hover:bg-muted hover:text-foreground transition-colors">
            <ArrowUpDown size={14} strokeWidth={1.75} />
            Sort
          </button>
          <Link
            href="/settings/pipeline"
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[13px] text-subtle hover:bg-muted hover:text-foreground transition-colors"
          >
            <SlidersHorizontal size={14} strokeWidth={1.75} />
            Options
          </Link>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4">
        <KanbanBoard opportunities={opportunities} stages={stages} onMove={moveOpportunity} />
      </div>
    </div>
  );
}

function KanbanBoard({
  opportunities,
  stages,
  onMove,
}: {
  opportunities: OpportunityRow[];
  stages: PipelineStage[];
  onMove: (id: string, stage: OpportunityStage) => void;
}) {
  const [dragOver, setDragOver] = useState<OpportunityStage | null>(null);

  return (
    <div className="flex gap-4 items-start">
      {stages.map((stage) => {
        const items = opportunities.filter((o) => o.stage === stage.label);
        const total = items.reduce((sum, o) => sum + o.value, 0);
        return (
          <div
            key={stage.id}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(stage.label);
            }}
            onDragLeave={() => setDragOver((s) => (s === stage.label ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/opportunity-id");
              if (id) onMove(id, stage.label);
              setDragOver(null);
            }}
            className={`w-56 shrink-0 rounded-lg transition-colors ${
              dragOver === stage.label ? "bg-muted/60" : ""
            }`}
          >
            <div className="flex items-center gap-2 px-1 mb-2 pt-1">
              <span className={`px-2 py-0.5 rounded-full text-[12px] font-medium ${OUTCOME_BADGE[stage.outcome] ?? "bg-muted"}`}>
                {stage.label}
              </span>
              <span className="text-[12px] text-subtle">
                {total > 0 ? formatValue(total) : 0}
              </span>
            </div>

            <div className="space-y-2 px-1 pb-2 min-h-8">
              {items.map((o) => {
                const owner = o.owner?.name ?? o.owner?.email ?? "";
                return (
                  <div
                    key={o.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/opportunity-id", o.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className="border border-border rounded-lg px-3 py-2.5 bg-surface cursor-grab active:cursor-grabbing space-y-1.5"
                  >
                    <Link href={`/deals/${o.id}`} className="text-[13px] leading-tight truncate block hover:underline">
                      {o.name || "Untitled"}
                    </Link>
                    <div className="flex items-center gap-1.5 text-[12px] text-subtle">
                      <DollarSign size={12} strokeWidth={1.75} className="shrink-0" />
                      {formatValue(o.value)}
                    </div>
                    {owner && (
                      <div className="flex items-center gap-1.5 text-[12px] text-subtle truncate">
                        <Avatar name={owner} />
                        <span className="truncate">{owner}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-[12px] text-subtle truncate">
                      <CalendarDays size={12} strokeWidth={1.75} className="shrink-0" />
                      <span className="truncate">{formatCloseDate(o.closeDate)}</span>
                    </div>
                    {(o.company || o.contact) && (
                      <div className="border border-border rounded-md divide-y divide-border overflow-hidden">
                        {o.company && (
                          <Link
                            href={`/companies/${o.company.id}`}
                            onClick={(e) => e.stopPropagation()}
                            draggable={false}
                            className="flex items-center gap-1.5 px-1.5 py-1 text-[12px] text-subtle hover:bg-muted hover:text-foreground transition-colors truncate"
                          >
                            <Building2 size={12} strokeWidth={1.75} className="shrink-0" />
                            <span className="truncate">{o.company.name || "Untitled"}</span>
                          </Link>
                        )}
                        {o.contact && (
                          <Link
                            href={`/contacts/${o.contact.id}`}
                            onClick={(e) => e.stopPropagation()}
                            draggable={false}
                            className="flex items-center gap-1.5 px-1.5 py-1 text-[12px] text-subtle hover:bg-muted hover:text-foreground transition-colors truncate"
                          >
                            <UserIcon size={12} strokeWidth={1.75} className="shrink-0" />
                            <span className="truncate">{contactName(o.contact)}</span>
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button className="w-full flex items-center gap-1.5 px-1 py-1.5 text-[13px] text-subtle hover:text-foreground transition-colors">
              <Plus size={14} strokeWidth={1.75} />
              New
            </button>
          </div>
        );
      })}
    </div>
  );
}
