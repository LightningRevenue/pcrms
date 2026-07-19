"use client";

import { useTransition } from "react";
import Link from "next/link";
import type { User, Workflow } from "@prisma/client";
import { List, Workflow as WorkflowIcon, ChevronDown, ListFilter, UserCircle, CalendarDays, Plus } from "lucide-react";
import { createWorkflow } from "@/lib/actions/workflows";

export type WorkflowRow = Workflow & { createdBy: User | null };

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

export function WorkflowsView({ workflows }: { workflows: WorkflowRow[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col h-screen">
      <div className="h-12 shrink-0 flex items-center justify-between px-6 border-b border-border">
        <div className="flex items-center gap-1.5 text-[13px]">
          <WorkflowIcon size={14} strokeWidth={1.75} className="text-amber-400" />
          <span className="font-medium">Workflows</span>
        </div>
        <button
          onClick={() => startTransition(() => createWorkflow())}
          disabled={pending}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Plus size={14} strokeWidth={2} />
          New Workflow
        </button>
      </div>

      <div className="h-11 shrink-0 flex items-center justify-between px-6 border-b border-border">
        <button className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors">
          <List size={14} strokeWidth={1.75} />
          All Workflows
          <span className="text-subtle">· {workflows.length}</span>
          <ChevronDown size={13} strokeWidth={1.75} />
        </button>

        <div className="flex items-center gap-1">
          <button className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[13px] text-subtle hover:bg-muted hover:text-foreground transition-colors">
            <ListFilter size={14} strokeWidth={1.75} />
            Filter
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <ListView workflows={workflows} />
      </div>
    </div>
  );
}

function ListView({ workflows }: { workflows: WorkflowRow[] }) {
  const gridTemplate = "28px 1fr 140px 180px 180px";

  return (
    <div className="min-w-max">
      <div
        className="grid px-6 py-2 text-[12px] text-subtle border-b border-border sticky top-0 bg-background z-10"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        <input type="checkbox" className="size-3.5 rounded-sm accent-accent" />
        <span className="flex items-center gap-1.5 pl-1">
          <WorkflowIcon size={13} strokeWidth={1.75} />
          Name
        </span>
        <span className="pl-1">Status</span>
        <span className="flex items-center gap-1.5 pl-1">
          <UserCircle size={13} strokeWidth={1.75} />
          Created by
        </span>
        <span className="flex items-center gap-1.5 pl-1">
          <CalendarDays size={13} strokeWidth={1.75} />
          Creation date
        </span>
      </div>
      <div className="divide-y divide-border">
        {workflows.length === 0 ? (
          <p className="px-6 py-8 text-[13px] text-subtle">No workflows yet.</p>
        ) : (
          workflows.map((w) => (
            <div
              key={w.id}
              className="grid px-6 py-2 items-center hover:bg-muted/40 transition-colors"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <input type="checkbox" className="size-3.5 rounded-sm accent-accent" />
              <Link href={`/workflows/${w.id}`} className="text-[13px] leading-tight truncate pl-1 hover:underline">
                {w.name}
              </Link>
              <span className="pl-1">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[12px] ${
                    w.active ? "bg-emerald-500 text-white" : "bg-muted text-subtle"
                  }`}
                >
                  {w.active ? "Active" : "Draft"}
                </span>
              </span>
              <span className="text-[13px] text-subtle truncate pl-1">
                {w.createdBy?.name ?? w.createdBy?.email ?? "—"}
              </span>
              <span className="text-[13px] text-subtle truncate pl-1">{relativeTime(w.createdAt)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
