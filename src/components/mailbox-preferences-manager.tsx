"use client";

import { useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";
import type { MailboxAccount } from "@prisma/client";
import { setMailboxPreference } from "@/lib/actions/mailbox-preferences";

type MailboxWithSelection = MailboxAccount & { selected: boolean };

export function MailboxPreferencesManager({ mailboxes: initial }: { mailboxes: MailboxWithSelection[] }) {
  const [mailboxes, setMailboxes] = useState(initial);
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();

  function toggle(id: string, selected: boolean) {
    setMailboxes((prev) => prev.map((m) => (m.id === id ? { ...m, selected } : m)));
    startTransition(() => setMailboxPreference(id, selected));
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mailboxes;
    return mailboxes.filter((m) => m.label.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
  }, [mailboxes, query]);

  if (mailboxes.length === 0) {
    return (
      <p className="text-[13px] text-subtle mt-3">
        No outreach mailboxes connected yet. Add one in Settings → Outreach Inboxes.
      </p>
    );
  }

  return (
    <div className="mt-3">
      <div className="relative mb-2">
        <Search size={14} strokeWidth={1.75} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search mailboxes..."
          className="w-full pl-8 pr-2.5 py-1.5 rounded-md border border-border bg-surface text-[13px] outline-none focus:border-accent transition-colors"
        />
      </div>
      <div className="border border-border rounded-md overflow-hidden">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-[13px] text-subtle text-center">No mailboxes match your search.</p>
        ) : (
          filtered.map((m) => (
            <label
              key={m.id}
              className="flex items-center gap-3 px-3 py-2.5 text-[13px] border-b border-border last:border-b-0 cursor-pointer hover:bg-muted transition-colors"
            >
              <input
                type="checkbox"
                checked={m.selected}
                onChange={(e) => toggle(m.id, e.target.checked)}
                className="accent-accent"
              />
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{m.label}</div>
                <div className="text-subtle text-[12px] truncate">{m.email}</div>
              </div>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
