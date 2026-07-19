import Link from "next/link";
import { Banknote } from "lucide-react";
import type { Opportunity } from "@prisma/client";

export function AssociatedDeals({ opportunities }: { opportunities: Opportunity[] }) {
  if (opportunities.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {opportunities.map((o) => (
        <Link
          key={o.id}
          href={`/deals/${o.id}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted text-[11px] text-subtle hover:text-foreground hover:bg-muted/70 transition-colors"
          title={`Go to ${o.name || "deal"}`}
        >
          <Banknote size={11} strokeWidth={1.75} />
          {o.name || "Untitled"}
        </Link>
      ))}
    </div>
  );
}
