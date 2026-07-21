"use client";

import { useTransition } from "react";
import { assignWorkspacePlan } from "@/lib/actions/plans";

export function WorkspacePlanSelect({
  workspaceId,
  planId,
  plans,
}: {
  workspaceId: string;
  planId: string;
  plans: { id: string; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={planId}
      disabled={isPending}
      onChange={(e) => startTransition(() => assignWorkspacePlan(workspaceId, e.target.value))}
      className="px-2.5 py-1.5 rounded-md border border-border bg-background text-[13px] outline-none cursor-pointer disabled:opacity-50"
    >
      {plans.map((p) => (
        <option key={p.id} value={p.id} className="bg-background text-foreground">
          {p.name}
        </option>
      ))}
    </select>
  );
}
