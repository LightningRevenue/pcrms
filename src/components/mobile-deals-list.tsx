"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Opportunity, PipelineStage, Company, Person } from "@prisma/client";

type OpportunityRow = Opportunity & { company: Company | null; contact: Person | null };

function formatCurrency(value: number) {
  return `$${value >= 1000 ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k` : value}`;
}

export function MobileDealsList({
  opportunities,
  stages,
}: {
  opportunities: OpportunityRow[];
  stages: PipelineStage[];
}) {
  const grouped = useMemo(() => {
    const byStage = new Map<string, OpportunityRow[]>();
    for (const o of opportunities) {
      const list = byStage.get(o.stage);
      if (list) list.push(o);
      else byStage.set(o.stage, [o]);
    }
    const orderedLabels = stages.map((s) => s.label).filter((l) => byStage.has(l));
    for (const label of byStage.keys()) {
      if (!orderedLabels.includes(label)) orderedLabels.push(label);
    }
    return orderedLabels.map((label) => ({ label, deals: byStage.get(label) ?? [] }));
  }, [opportunities, stages]);

  if (opportunities.length === 0) {
    return <div className="p-4 text-[13px] text-subtle">No deals yet.</div>;
  }

  return (
    <div className="pb-4">
      {grouped.map(({ label, deals }) => (
        <div key={label}>
          <div className="sticky top-0 bg-background px-4 py-2 border-b border-border flex items-center justify-between">
            <span className="text-[12px] font-bold text-subtle uppercase tracking-wider">{label}</span>
            <span className="text-[11px] text-subtle">{deals.length}</span>
          </div>
          <div className="divide-y divide-border">
            {deals.map((d) => (
              <Link
                key={d.id}
                href={`/m/deals/${d.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 active:bg-muted transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold truncate">{d.name}</p>
                  <p className="text-[12px] text-subtle truncate">
                    {d.contact ? [d.contact.firstName, d.contact.lastName].filter(Boolean).join(" ") : d.company?.name ?? "—"}
                  </p>
                </div>
                <span className="text-[13px] font-bold shrink-0">{formatCurrency(d.value)}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
