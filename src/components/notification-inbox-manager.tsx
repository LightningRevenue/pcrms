"use client";

import { useState, useTransition } from "react";
import { setNotificationInbox } from "@/lib/actions/notification-inbox";

type MailboxOption = { id: string; label: string; email: string };
type Owner = { id: string; email: string | null; name: string | null };

export function NotificationInboxManager({
  owner,
  mailboxes,
  selected: initialSelected,
  canEdit,
}: {
  owner: Owner | null;
  mailboxes: MailboxOption[];
  selected: string | null;
  canEdit: boolean;
}) {
  const [selected, setSelected] = useState(initialSelected ?? "");
  const [, startTransition] = useTransition();

  function choose(value: string) {
    setSelected(value);
    startTransition(() => setNotificationInbox(value));
  }

  return (
    <div className="mt-3 border border-border rounded-md overflow-hidden">
      {owner && (
        <label
          className={`flex items-center gap-3 px-3 py-2.5 text-[13px] border-b border-border last:border-b-0 ${
            canEdit ? "cursor-pointer hover:bg-muted transition-colors" : "cursor-not-allowed opacity-60"
          }`}
        >
          <input
            type="radio"
            name="notification-inbox"
            checked={selected === "gmail"}
            onChange={() => canEdit && choose("gmail")}
            disabled={!canEdit}
            className="accent-accent"
          />
          <div className="min-w-0 flex-1">
            <div className="font-medium">Gmail (workspace owner)</div>
            <div className="text-subtle text-[12px] truncate">{owner.email ?? owner.name ?? "Owner account"}</div>
          </div>
        </label>
      )}

      {mailboxes.map((m) => (
        <label
          key={m.id}
          className={`flex items-center gap-3 px-3 py-2.5 text-[13px] border-b border-border last:border-b-0 ${
            canEdit ? "cursor-pointer hover:bg-muted transition-colors" : "cursor-not-allowed opacity-60"
          }`}
        >
          <input
            type="radio"
            name="notification-inbox"
            checked={selected === m.id}
            onChange={() => canEdit && choose(m.id)}
            disabled={!canEdit}
            className="accent-accent"
          />
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{m.label}</div>
            <div className="text-subtle text-[12px] truncate">{m.email}</div>
          </div>
        </label>
      ))}
    </div>
  );
}
