"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { UserX } from "lucide-react";
import { toggleContactUnsubscribe } from "@/lib/actions/gdpr";

// Any workspace member can check this box to unsubscribe a contact — it's a one-way door for
// them (see toggleContactUnsubscribe's comment): once checked, only the owner can uncheck it.
export function UnsubscribeToggle({ personId, unsubscribedAt }: { personId: string; unsubscribedAt: Date | null }) {
  const { data: session } = useSession();
  const isOwner = session?.user?.role === "owner";
  const [checked, setChecked] = useState(!!unsubscribedAt);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const locked = checked && !isOwner;

  function handleChange(next: boolean) {
    if (locked) return;
    setError(null);
    setChecked(next);
    startTransition(async () => {
      try {
        await toggleContactUnsubscribe(personId, next);
      } catch (err) {
        setChecked(!next);
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-muted transition-colors">
      <label
        className={`flex items-center gap-2 text-[13px] ${locked ? "cursor-not-allowed" : "cursor-pointer"}`}
        title={locked ? "Only the workspace owner can resubscribe this contact" : undefined}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={locked}
          onChange={(e) => handleChange(e.target.checked)}
          className="accent-accent disabled:opacity-60"
        />
        <UserX size={14} strokeWidth={1.75} className="text-subtle" />
        Unsubscribed
      </label>
      {error && <span className="text-[11px] text-red-400">{error}</span>}
    </div>
  );
}
