"use client";

import { useState, useTransition } from "react";

export function EditableFieldRow({
  icon: Icon,
  label,
  value,
  placeholder,
  onSave,
  type = "text",
  options,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  value: string;
  placeholder?: string;
  onSave: (value: string) => Promise<void>;
  type?: "text" | "number" | "date" | "select";
  options?: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, startTransition] = useTransition();

  function commit(next: string) {
    setEditing(false);
    if (next === value) return;
    startTransition(() => onSave(next));
  }

  return (
    <div className="flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-muted transition-colors">
      <div className="flex items-center gap-2 w-28 shrink-0 text-[13px] text-subtle truncate">
        <Icon size={14} strokeWidth={1.75} />
        {label}
      </div>
      {type === "select" ? (
        <select
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            commit(e.target.value);
          }}
          className="flex-1 min-w-0 bg-transparent text-[13px] outline-none border-b border-border"
        >
          <option value="" className="bg-background text-foreground">
            {placeholder || "Empty"}
          </option>
          {options?.map((o) => (
            <option key={o} value={o} className="bg-background text-foreground">
              {o}
            </option>
          ))}
        </select>
      ) : editing ? (
        <input
          autoFocus
          type={type === "number" ? "number" : type === "date" ? "date" : "text"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent text-[13px] outline-none border-b border-border placeholder:text-subtle"
        />
      ) : (
        <button
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          className={`flex-1 min-w-0 text-left text-[13px] truncate ${!value ? "text-subtle" : ""} ${pending ? "opacity-50" : ""}`}
        >
          {value || placeholder || "Empty"}
        </button>
      )}
    </div>
  );
}
