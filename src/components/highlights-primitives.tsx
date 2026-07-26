"use client";

import type { Mail } from "lucide-react";

// Shared building blocks for the Salesforce-style highlights bars on /lead/[id] and
// /companies/[id]. Only the small pieces are shared — each bar keeps its own layout, since
// the fields and actions genuinely differ (a company has no phone, sequence or convert).

/** Inline-editable title input that sizes itself to its content. */
export function NameInput({
  value,
  onChange,
  onCommit,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      placeholder={placeholder}
      size={Math.max(value.length || placeholder.length, 1)}
      className="w-auto max-w-full bg-transparent text-[19px] font-medium leading-tight outline-none border-b border-transparent hover:border-border focus:border-border transition-colors placeholder:text-subtle placeholder:font-normal"
    />
  );
}

/** Labelled read-at-a-glance field in the highlights row. */
export function HighlightField({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Mail;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 max-w-[220px]">
      <p className="flex items-center gap-1 text-[11px] text-subtle uppercase tracking-wide">
        <Icon size={11} strokeWidth={1.75} />
        {label}
      </p>
      <div className="text-[13px] truncate">{children}</div>
    </div>
  );
}

export function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  title,
}: {
  icon: typeof Mail;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[13px] hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <Icon size={14} strokeWidth={1.75} />
      {label}
    </button>
  );
}

export function dueLabel(date: Date | null) {
  if (!date) return "no due date";
  const days = Math.round((date.getTime() - Date.now()) / 86_400_000);
  if (days < -1) return `overdue by ${-days}d`;
  if (days === -1) return "overdue by 1d";
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `due in ${days}d`;
}
