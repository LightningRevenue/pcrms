"use client";

import { useState } from "react";
import { Clock, X } from "lucide-react";

// Formats a Date for <input type="datetime-local">, which wants local time with no zone.
function toLocalInputValue(d: Date) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function atHour(daysFromNow: number, hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d;
}

// Next weekday morning — skips Saturday/Sunday, since "tomorrow 8am" on a Friday means Monday
// for anyone doing outreach.
function nextWeekdayMorning() {
  const d = atHour(1, 8);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

function presets() {
  const now = new Date();
  const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const list = [
    { label: "In 2 hours", date: inTwoHours },
    { label: "Tomorrow morning", date: nextWeekdayMorning() },
    { label: "Monday morning", date: nextMonday() },
  ];
  // Later today only makes sense while there's still a workday left.
  if (now.getHours() < 15) list.unshift({ label: "This afternoon", date: atHour(0, 16) });
  return list.filter((p) => p.date.getTime() > now.getTime());
}

function nextMonday() {
  const d = atHour(1, 8);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  return d;
}

const formatWhen = (d: Date) =>
  d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function ScheduleSendDialog({
  onSchedule,
  onClose,
  pending,
}: {
  onSchedule: (isoString: string) => void;
  onClose: () => void;
  pending?: boolean;
}) {
  const options = presets();
  const [custom, setCustom] = useState(toLocalInputValue(nextWeekdayMorning()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10 text-accent shrink-0">
            <Clock size={16} strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium">Send later</p>
            <p className="text-[11.5px] text-subtle">Delivered automatically at the time you pick</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-subtle hover:bg-muted hover:text-foreground transition-colors shrink-0"
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-2 pb-2">
          {options.map((p) => (
            <button
              key={p.label}
              onClick={() => onSchedule(p.date.toISOString())}
              disabled={pending}
              className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-md text-[13px] hover:bg-muted transition-colors disabled:opacity-50"
            >
              <span>{p.label}</span>
              <span className="text-[11.5px] text-subtle">{formatWhen(p.date)}</span>
            </button>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-border">
          <label className="block text-[11px] font-medium text-subtle uppercase tracking-wide mb-1.5">
            Or pick a time
          </label>
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              min={toLocalInputValue(new Date())}
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md border border-border bg-transparent text-[13px] outline-none focus:border-accent"
            />
            <button
              onClick={() => custom && onSchedule(new Date(custom).toISOString())}
              disabled={pending || !custom}
              className="px-3 py-1.5 rounded-md text-[13px] border border-accent text-accent bg-accent/10 hover:bg-accent/20 transition-colors disabled:opacity-50 shrink-0"
            >
              {pending ? "Scheduling…" : "Schedule"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
