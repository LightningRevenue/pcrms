import { Box, Users, Target, Boxes } from "lucide-react";

function Node({
  icon: Icon,
  label,
  sub,
  badge,
}: {
  icon: typeof Box;
  label: string;
  sub: string;
  badge?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-background shadow-sm px-3 py-2 text-[12px] w-40">
      <div className="flex items-center gap-1.5 font-medium">
        {badge ? (
          <span className="flex items-center justify-center w-3.5 h-3.5 rounded-[3px] bg-orange-500 text-white text-[9px] font-medium shrink-0">
            {badge}
          </span>
        ) : (
          <Icon size={13} strokeWidth={1.75} className="text-subtle shrink-0" />
        )}
        {label}
      </div>
      <div className="text-subtle mt-1">{sub}</div>
    </div>
  );
}

export function DataModelDiagram() {
  return (
    <div className="relative rounded-lg border border-border bg-muted/30 h-48 overflow-hidden [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:16px_16px]">
      <div className="absolute inset-0 flex items-center justify-center gap-16 px-10">
        <div className="flex flex-col gap-6">
          <Node icon={Boxes} label="Custom" sub="14 fields" badge="C" />
          <Node icon={Users} label="Users" sub="497" />
        </div>
        <Node icon={Box} label="Standard" sub="31 fields" />
        <div className="flex flex-col gap-2">
          <span className="text-[11px] text-subtle px-1">Opportunities · 42</span>
          <Node icon={Target} label="Standard" sub="12 fields" />
        </div>
      </div>
    </div>
  );
}
