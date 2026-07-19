"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const QUICK_HOURS = [9, 10, 11, 12, 14, 16, 17, 18];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseValue(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildGrid(monthCursor: Date) {
  const first = startOfMonth(monthCursor);
  const startOffset = (first.getDay() + 6) % 7; // Monday-first
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

export function DatePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const selected = parseValue(value);
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(selected ?? new Date()));
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const PANEL_HEIGHT = 330;
  const PANEL_WIDTH = 256;

  useEffect(() => {
    if (!open) return;
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) {
      const spaceBelow = window.innerHeight - r.bottom;
      const left = Math.min(r.left, window.innerWidth - PANEL_WIDTH - 8);
      if (spaceBelow < PANEL_HEIGHT + 8) {
        setRect({ bottom: window.innerHeight - r.top + 4, left });
      } else {
        setRect({ top: r.bottom + 4, left });
      }
    }
    setMonthCursor(startOfMonth(selected ?? new Date()));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pickDay(day: Date) {
    const next = new Date(day);
    if (selected) next.setHours(selected.getHours(), selected.getMinutes());
    else next.setHours(9, 0);
    onChange(toLocalValue(next));
  }

  function pickQuick(daysFromToday: number) {
    const next = new Date();
    next.setDate(next.getDate() + daysFromToday);
    next.setHours(selected?.getHours() ?? 9, selected?.getMinutes() ?? 0, 0, 0);
    onChange(toLocalValue(next));
    setOpen(false);
  }

  function setHour(hour: number) {
    const base = selected ?? new Date();
    const next = new Date(base);
    next.setHours(hour, selected?.getMinutes() ?? 0);
    onChange(toLocalValue(next));
  }

  function setMinute(minute: number) {
    const base = selected ?? new Date();
    const next = new Date(base);
    next.setHours(selected?.getHours() ?? 9, minute);
    onChange(toLocalValue(next));
  }

  const grid = buildGrid(monthCursor);
  const today = new Date();

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        className="flex-1 min-w-0 text-left text-[13px] outline-none bg-transparent truncate"
      >
        {selected
          ? selected.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
          : <span className="text-subtle">Set due date</span>}
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: rect.top, bottom: rect.bottom, left: rect.left }}
            className="fixed z-[100] w-64 rounded-md border border-border bg-background shadow-lg p-3"
          >
            <div className="flex items-center gap-1.5 mb-2">
              {[
                { label: "Today", days: 0 },
                { label: "Tomorrow", days: 1 },
                { label: "Next week", days: 7 },
              ].map((q) => (
                <button
                  key={q.label}
                  onClick={() => pickQuick(q.days)}
                  className="px-2 py-1 rounded-md border border-border text-[11px] text-subtle hover:bg-muted hover:text-foreground transition-colors"
                >
                  {q.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                className="p-1 rounded text-subtle hover:bg-muted hover:text-foreground transition-colors"
              >
                <ChevronLeft size={14} strokeWidth={1.75} />
              </button>
              <span className="text-[12px] font-medium">
                {monthCursor.toLocaleString(undefined, { month: "long", year: "numeric" })}
              </span>
              <button
                onClick={() => setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                className="p-1 rounded text-subtle hover:bg-muted hover:text-foreground transition-colors"
              >
                <ChevronRight size={14} strokeWidth={1.75} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-y-1 text-center">
              {WEEKDAYS.map((w) => (
                <span key={w} className="text-[10px] text-subtle">
                  {w}
                </span>
              ))}
              {grid.map((day) => {
                const inMonth = day.getMonth() === monthCursor.getMonth();
                const isSelected = selected && sameDay(day, selected);
                const isToday = sameDay(day, today);
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => pickDay(day)}
                    className={`size-7 mx-auto rounded-md text-[12px] flex items-center justify-center transition-colors ${
                      isSelected
                        ? "bg-accent text-white"
                        : isToday
                          ? "border border-accent text-foreground"
                          : inMonth
                            ? "text-foreground hover:bg-muted"
                            : "text-subtle/40 hover:bg-muted"
                    }`}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-1.5 mb-2">
                <Clock size={13} strokeWidth={1.75} className="text-subtle shrink-0" />
                <span className="text-[11px] text-subtle">Time</span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {QUICK_HOURS.map((h) => {
                  const active = selected?.getHours() === h;
                  return (
                    <button
                      key={h}
                      onClick={() => setHour(h)}
                      className={`py-1 rounded-md text-[12px] transition-colors ${
                        active ? "bg-accent text-white" : "text-subtle hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {pad(h)}:00
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] text-subtle shrink-0">Exact</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={selected ? pad(selected.getHours()) : ""}
                  onChange={(e) => setHour(Math.min(23, Math.max(0, Number(e.target.value) || 0)))}
                  placeholder="HH"
                  className="w-10 text-[13px] text-center outline-none bg-transparent border-b border-border placeholder:text-subtle"
                />
                <span className="text-subtle">:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  step={5}
                  value={selected ? pad(selected.getMinutes()) : ""}
                  onChange={(e) => setMinute(Math.min(59, Math.max(0, Number(e.target.value) || 0)))}
                  placeholder="MM"
                  className="w-10 text-[13px] text-center outline-none bg-transparent border-b border-border placeholder:text-subtle"
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
