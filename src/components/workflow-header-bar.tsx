"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  History,
  FileX,
  Heart,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  X,
} from "lucide-react";
import { renameWorkflow, discardWorkflow } from "@/lib/actions/workflows";

export function WorkflowHeaderBar({
  workflowId,
  name,
  active,
}: {
  workflowId: string;
  name: string;
  active: boolean;
}) {
  const [value, setValue] = useState(name);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function commitName() {
    if (value.trim() === name) return;
    startTransition(() => renameWorkflow(workflowId, value));
  }

  return (
    <div className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-border">
      <div className="flex items-center gap-2 text-[13px] text-subtle min-w-0">
        <Link href="/workflows" className="hover:text-foreground transition-colors shrink-0">
          Workflows
        </Link>
        <span>/</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commitName}
          className="bg-transparent text-foreground outline-none border-b border-transparent focus:border-border min-w-0"
          style={{ width: `${Math.max(value.length, 4)}ch` }}
        />
        {!active && (
          <span className="ml-2 shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-300">
            Draft
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[13px] hover:bg-muted transition-colors">
          <History size={14} strokeWidth={1.75} />
          See Runs
        </button>
        <button
          onClick={() => startTransition(() => discardWorkflow(workflowId))}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[13px] hover:bg-muted transition-colors"
        >
          <FileX size={14} strokeWidth={1.75} />
          Discard Draft
        </button>
        <button className="p-1.5 rounded-md border border-border hover:bg-muted transition-colors">
          <Heart size={14} strokeWidth={1.75} />
        </button>
        <button className="p-1.5 rounded-md border border-border hover:bg-muted transition-colors">
          <ChevronUp size={14} strokeWidth={1.75} />
        </button>
        <button className="p-1.5 rounded-md border border-border hover:bg-muted transition-colors">
          <ChevronDown size={14} strokeWidth={1.75} />
        </button>
        <button className="p-1.5 rounded-md border border-border hover:bg-muted transition-colors">
          <MoreHorizontal size={14} strokeWidth={1.75} />
        </button>
        <button
          onClick={() => router.push("/workflows")}
          className="p-1.5 rounded-md border border-border hover:bg-muted transition-colors"
        >
          <X size={14} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
