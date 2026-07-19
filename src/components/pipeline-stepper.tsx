"use client";

import { Check } from "lucide-react";
import type { PipelineStage } from "@prisma/client";
import type { OpportunityStage } from "@/components/opportunities-view";

export function PipelineStepper({
  stage,
  stages,
  onChange,
}: {
  stage: OpportunityStage;
  stages: PipelineStage[];
  onChange: (stage: OpportunityStage) => void;
}) {
  const currentIndex = stages.findIndex((s) => s.label === stage);

  return (
    <div className="h-11 shrink-0 flex items-center px-6 border-b border-border">
      {stages.map((s, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={s.id} className="flex items-center flex-1 last:flex-initial">
            <button
              onClick={() => onChange(s.label)}
              className="group flex items-center gap-2 shrink-0"
            >
              <span
                className={`size-4 shrink-0 rounded-full flex items-center justify-center transition-colors ${
                  done
                    ? "bg-emerald-400"
                    : active
                    ? "bg-accent ring-4 ring-accent/20"
                    : "bg-muted border border-border group-hover:border-subtle"
                }`}
              >
                {done && <Check size={11} strokeWidth={3} className="text-background" />}
              </span>
              <span
                className={`text-[13px] transition-colors ${
                  active
                    ? "text-foreground font-medium"
                    : done
                    ? "text-subtle group-hover:text-foreground"
                    : "text-subtle group-hover:text-foreground"
                }`}
              >
                {s.label}
              </span>
            </button>
            {i < stages.length - 1 && (
              <div className={`h-px flex-1 mx-3 ${done ? "bg-emerald-400/40" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
