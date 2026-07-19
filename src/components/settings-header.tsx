"use client";

import Link from "next/link";
import { X } from "lucide-react";

export function SettingsHeader({ crumbs }: { crumbs: string[] }) {
  return (
    <div className="h-12 shrink-0 border-b border-border flex items-center px-4 gap-3">
      <Link
        href="/"
        title="Back to CRM"
        className="p-1.5 rounded-md text-subtle hover:bg-muted hover:text-foreground transition-colors"
      >
        <X size={16} strokeWidth={1.75} />
      </Link>
      <div className="text-[13px] text-subtle">
        {crumbs.map((crumb, i) => (
          <span key={i}>
            {i > 0 && <span className="mx-1.5">/</span>}
            <span className={i === crumbs.length - 1 ? "text-foreground font-medium" : ""}>
              {crumb}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
