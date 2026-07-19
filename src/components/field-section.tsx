"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function FieldSection({
  title,
  children,
  alert,
}: {
  title: string;
  children: React.ReactNode;
  alert?: boolean;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="py-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-1 py-1 text-[12px] font-medium text-subtle uppercase tracking-wide"
      >
        <span className="flex items-center gap-1.5">
          {title}
          {alert && <span className="size-1.5 rounded-full bg-red-500" />}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={1.75}
          className={`transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && <div className="mt-1 space-y-0.5">{children}</div>}
    </div>
  );
}
