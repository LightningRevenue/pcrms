"use client";

import { useState, useTransition } from "react";
import { CreditCard } from "lucide-react";
import { createCheckoutSession, createPortalSession } from "@/lib/actions/checkout";

export function BillingActions({
  hasBillingAccount,
  upgradePlans,
}: {
  hasBillingAccount: boolean;
  upgradePlans: { id: string; name: string }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function upgrade(planId: string) {
    setError(null);
    startTransition(async () => {
      try {
        const url = await createCheckoutSession(planId);
        window.location.href = url;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start checkout");
      }
    });
  }

  function manage() {
    setError(null);
    startTransition(async () => {
      try {
        const url = await createPortalSession();
        window.location.href = url;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not open billing portal");
      }
    });
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 flex-wrap">
        {upgradePlans.map((p) => (
          <button
            key={p.id}
            onClick={() => upgrade(p.id)}
            disabled={pending}
            className="px-3 py-1.5 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Upgrade to {p.name}
          </button>
        ))}
        {hasBillingAccount && (
          <button
            onClick={manage}
            disabled={pending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            <CreditCard size={14} strokeWidth={1.75} />
            Manage billing
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-[12px] text-red-400">{error}</p>}
    </div>
  );
}
