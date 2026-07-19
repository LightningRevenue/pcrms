"use client";

import { useState } from "react";

export function BlocklistForm() {
  const [blocklist, setBlocklist] = useState("");

  return (
    <div className="mt-3 flex gap-2">
      <input
        value={blocklist}
        onChange={(e) => setBlocklist(e.target.value)}
        placeholder="eddy@gmail.com, @apple.com"
        className="flex-1 px-2.5 py-1.5 rounded-md border border-border bg-background text-[13px] outline-none focus:border-accent"
      />
      <button className="px-2.5 py-1.5 rounded-md border border-border text-[13px] hover:bg-muted transition-colors shrink-0">
        Add to blocklist
      </button>
    </div>
  );
}
