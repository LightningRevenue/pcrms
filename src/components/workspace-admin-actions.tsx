"use client";

import { useTransition } from "react";
import { suspendWorkspace, reactivateWorkspace } from "@/lib/actions/admin";

export function WorkspaceAdminActions({ workspaceId, suspended }: { workspaceId: string; suspended: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (suspended) {
      startTransition(() => reactivateWorkspace(workspaceId));
      return;
    }
    if (!confirm("Suspend this workspace? Every member will lose access immediately.")) return;
    startTransition(() => suspendWorkspace(workspaceId));
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors disabled:opacity-50 ${
        suspended
          ? "bg-accent text-white hover:opacity-90"
          : "text-red-500 border border-red-500/30 hover:bg-red-500/10"
      }`}
    >
      {isPending ? "Working…" : suspended ? "Reactivate" : "Suspend"}
    </button>
  );
}
