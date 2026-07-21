import { Check, X } from "lucide-react";
import { BillingActions } from "@/components/billing-actions";

type UsageEntry = { key: string; label: string; type: "count" | "monthly"; current: number; limit: number | null };
type FeatureEntry = { key: string; label: string; allowed: boolean };

export function BillingView({
  planName,
  usage,
  features,
  hasBillingAccount,
  upgradePlans,
}: {
  planName: string;
  usage: UsageEntry[];
  features: FeatureEntry[];
  hasBillingAccount: boolean;
  upgradePlans: { id: string; name: string }[];
}) {
  const monthly = usage.filter((u) => u.type === "monthly");
  const counts = usage.filter((u) => u.type === "count");

  return (
    <div className="mt-6">
      <div className="border border-border rounded-lg px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-subtle uppercase tracking-wide">Current plan</p>
            <p className="text-[16px] font-medium mt-0.5">{planName}</p>
          </div>
          <span className="px-2.5 py-1 rounded-md text-[12px] bg-accent/10 text-accent">Active</span>
        </div>
        <BillingActions hasBillingAccount={hasBillingAccount} upgradePlans={upgradePlans} />
      </div>

      {features.length > 0 && (
        <>
          <p className="text-[12px] font-medium text-subtle uppercase tracking-wide mt-6">Features</p>
          <div className="mt-2 border border-border rounded-md overflow-hidden">
            {features.map((f) => (
              <div key={f.key} className="flex items-center justify-between px-3 py-2.5 text-[13px] border-b border-border last:border-b-0">
                <span>{f.label}</span>
                {f.allowed ? (
                  <span className="flex items-center gap-1 text-emerald-500 text-[12px]">
                    <Check size={13} strokeWidth={2} />
                    Enabled
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-subtle text-[12px]">
                    <X size={13} strokeWidth={2} />
                    Not on this plan
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {counts.length > 0 && (
        <>
          <p className="text-[12px] font-medium text-subtle uppercase tracking-wide mt-6">Usage</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {counts.map((u) => (
              <UsageCard key={u.key} entry={u} />
            ))}
          </div>
        </>
      )}

      {monthly.length > 0 && (
        <>
          <p className="text-[12px] font-medium text-subtle uppercase tracking-wide mt-6">This month</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {monthly.map((u) => (
              <UsageCard key={u.key} entry={u} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function UsageCard({ entry }: { entry: UsageEntry }) {
  const pct = entry.limit ? Math.min(100, Math.round((entry.current / entry.limit) * 100)) : 0;
  const nearLimit = entry.limit !== null && pct >= 90;

  return (
    <div className="border border-border rounded-md p-3">
      <p className="text-[12px] text-subtle truncate">{entry.label}</p>
      <p className="text-[16px] font-medium mt-0.5">
        {entry.current}
        {entry.limit !== null && <span className="text-subtle font-normal"> / {entry.limit}</span>}
      </p>
      {entry.limit !== null && (
        <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${nearLimit ? "bg-red-500" : "bg-accent"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
