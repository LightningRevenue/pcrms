"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronUp,
  EyeOff,
  Plus,
  SlidersHorizontal as OptionsIcon,
} from "lucide-react";

// Shared table chrome for the /contacts and /companies grids: sortable + draggable + resizable
// column headers, and the "+" that adds a column. Extracted from contacts-view so the two lists
// can't drift apart — the column key type is the only thing that differs, so it's a generic.

export type SortDir = "asc" | "desc";
export type CustomFieldDef = { id: string; key: string; label: string };

export const DEFAULT_COL_WIDTH = 150;
const MIN_COL_WIDTH = 80;
const MAX_COL_WIDTH = 600;

export const clampWidth = (px: number) => Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, px));

/** Column visibility + widths, persisted per list under its own storage keys. */
export function useVisibleColumns<K extends string>(
  storageKey: string,
  widthStorageKey: string,
  defaultVisible: K[],
  allKeys: K[]
) {
  const [visible, setVisible] = useState<K[]>(defaultVisible);

  // allKeys is rebuilt every render by callers; a ref keeps the one-shot restore below from
  // needing it as a dep (which would re-run the effect and clobber later toggles).
  const allKeysRef = useRef(allKeys);
  allKeysRef.current = allKeys;

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return;
    try {
      const parsed: string[] = JSON.parse(stored);
      setVisible(parsed.filter((k): k is K => allKeysRef.current.includes(k as K)));
    } catch {
      // ignore malformed storage
    }
  }, [storageKey]);

  function toggle(key: K) {
    setVisible((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  /** Moves `key` to sit where `before` currently is. Same array = same persisted order. */
  function reorder(key: K, before: K) {
    setVisible((prev) => {
      if (key === before) return prev;
      const without = prev.filter((k) => k !== key);
      const at = without.indexOf(before);
      if (at === -1) return prev;
      const next = [...without.slice(0, at), key, ...without.slice(at)];
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  // Widths live under their own key rather than inside the visibility array, so an existing
  // saved column set survives this being added.
  const [widths, setWidths] = useState<Record<string, number>>({});

  useEffect(() => {
    const stored = localStorage.getItem(widthStorageKey);
    if (!stored) return;
    try {
      setWidths(JSON.parse(stored));
    } catch {
      // ignore malformed storage
    }
  }, [widthStorageKey]);

  function setWidth(key: K, px: number) {
    setWidths((prev) => {
      const next = { ...prev, [key]: Math.round(clampWidth(px)) };
      localStorage.setItem(widthStorageKey, JSON.stringify(next));
      return next;
    });
  }

  return { visible, toggle, reorder, widths, setWidth };
}

/** Builds the ordered column list from visibleColumns' own order, so a drag persists as a reorder. */
export function useColumnList<K extends string>(
  visibleColumns: K[],
  standardColumns: readonly { key: string; label: string; icon: typeof OptionsIcon }[],
  customFields: CustomFieldDef[]
) {
  return useMemo(
    () =>
      visibleColumns.flatMap((key) => {
        if (key.startsWith("custom:")) {
          const f = customFields.find((f) => `custom:${f.id}` === key);
          return f ? [{ key, label: f.label, icon: OptionsIcon }] : [];
        }
        const c = standardColumns.find((c) => c.key === key);
        return c ? [{ key: c.key as K, label: c.label, icon: c.icon }] : [];
      }),
    [visibleColumns, standardColumns, customFields]
  );
}

// One header cell: click opens sort/hide, drag reorders. Uses native HTML5 drag events rather
// than a dnd library — it's a single-axis reorder of a handful of cells.
export function ColumnHeader<K extends string>({
  column,
  sort,
  onSort,
  onHide,
  onDropBefore,
  onResize,
  dragging,
  onDragKeyChange,
}: {
  column: { key: K; label: string; icon: typeof OptionsIcon };
  sort: { key: K; dir: SortDir } | null;
  onSort: (key: K, dir?: SortDir) => void;
  onHide?: (key: K) => void;
  onDropBefore?: (key: K, before: K) => void;
  onResize?: (key: K, px: number) => void;
  dragging: K | null;
  onDragKeyChange: (key: K | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [over, setOver] = useState(false);
  const [resizing, setResizing] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);
  const active = sort?.key === column.key;
  const isDragged = dragging === column.key;

  // Pointer capture keeps the drag alive when the cursor leaves the 5px handle, and a single
  // listener pair means no cleanup is left behind if the pointer is released off-window.
  function startResize(e: React.PointerEvent) {
    if (!onResize) return;
    e.preventDefault();
    e.stopPropagation();
    const left = cellRef.current?.getBoundingClientRect().left ?? 0;
    setResizing(true);

    const move = (ev: PointerEvent) => onResize(column.key, clampWidth(ev.clientX - left));
    const up = () => {
      setResizing(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function setDir(dir: SortDir) {
    onSort(column.key, dir);
    setOpen(false);
  }

  return (
    <div
      ref={cellRef}
      // Reordering is off while resizing, or HTML5 drag hijacks the handle's pointer gesture.
      draggable={!!onDropBefore && !resizing}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        // Firefox won't start a drag without payload, even though we track it in state.
        e.dataTransfer.setData("text/plain", column.key);
        onDragKeyChange(column.key);
      }}
      onDragEnd={() => {
        onDragKeyChange(null);
        setOver(false);
      }}
      onDragOver={(e) => {
        if (!dragging || dragging === column.key) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (dragging && dragging !== column.key) onDropBefore?.(dragging, column.key);
        onDragKeyChange(null);
      }}
      className={`relative flex items-center border-l border-border ${isDragged ? "opacity-40" : ""} ${
        over ? "bg-accent/10 shadow-[inset_2px_0_0_0_var(--color-accent,#6366f1)]" : ""
      }`}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex-1 flex items-center gap-1.5 h-8 px-2 min-w-0 text-left hover:text-foreground transition-colors cursor-grab active:cursor-grabbing"
      >
        <column.icon size={13} strokeWidth={1.75} className="shrink-0" />
        <span className="truncate">{column.label}</span>
        {active &&
          (sort!.dir === "asc" ? (
            <ChevronUp size={12} strokeWidth={2} className="shrink-0" />
          ) : (
            <ChevronDown size={12} strokeWidth={2} className="shrink-0" />
          ))}
      </button>

      {onResize && (
        <div
          onPointerDown={startResize}
          onDoubleClick={() => onResize(column.key, DEFAULT_COL_WIDTH)}
          title="Drag to resize, double-click to reset"
          className={`absolute right-0 top-0 h-full w-[5px] cursor-col-resize z-10 hover:bg-accent/60 ${
            resizing ? "bg-accent" : ""
          }`}
        />
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-30 w-44 py-1 rounded-lg border border-border bg-surface shadow-xl font-normal">
            <button
              onClick={() => setDir("asc")}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] hover:bg-muted transition-colors"
            >
              <ChevronUp size={13} strokeWidth={1.75} className="text-subtle" />
              Sort ascending
              {active && sort!.dir === "asc" && <Check size={13} strokeWidth={2} className="ml-auto text-accent" />}
            </button>
            <button
              onClick={() => setDir("desc")}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] hover:bg-muted transition-colors"
            >
              <ChevronDown size={13} strokeWidth={1.75} className="text-subtle" />
              Sort descending
              {active && sort!.dir === "desc" && <Check size={13} strokeWidth={2} className="ml-auto text-accent" />}
            </button>
            {onHide && (
              <button
                onClick={() => {
                  onHide(column.key);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] border-t border-border mt-1 hover:bg-muted transition-colors"
              >
                <EyeOff size={13} strokeWidth={1.75} className="text-subtle" />
                Hide column
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// The "+" at the end of the header row: adds a column to the table. Lives in the header rather
// than a toolbar menu so it reads as "add a column here" instead of a settings dialog.
export function AddColumnButton<K extends string>({
  standardColumns,
  customFields,
  visibleColumns,
  onToggle,
  customizeHref,
}: {
  standardColumns: readonly { key: string; label: string; icon: typeof OptionsIcon }[];
  customFields: CustomFieldDef[];
  visibleColumns: K[];
  onToggle: (key: K) => void;
  customizeHref: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const standard = standardColumns.filter((c) => !q || c.label.toLowerCase().includes(q));
  const custom = customFields.filter((f) => !q || f.label.toLowerCase().includes(q));

  function pick(key: K) {
    onToggle(key);
    setQuery("");
  }

  return (
    <div className="relative flex items-center justify-center">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Add column"
        className="flex items-center justify-center size-6 rounded text-subtle hover:bg-muted hover:text-foreground transition-colors"
      >
        <Plus size={14} strokeWidth={1.75} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          {/* Anchored right: the button sits at the table's right edge, so a left-anchored menu
              would run off screen. */}
          <div className="absolute right-0 top-full mt-1 w-60 border border-border rounded-lg bg-surface shadow-xl z-30 py-1 font-normal">
            <div className="px-2 py-1.5">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search fields…"
                className="w-full px-2 py-1 text-[12.5px] rounded border border-border bg-transparent outline-none focus:border-accent"
              />
            </div>
            <div className="max-h-80 overflow-auto">
              {standard.length === 0 && custom.length === 0 && (
                <p className="px-3 py-2 text-[12.5px] text-subtle">No match.</p>
              )}
              {standard.map((col) => {
                const checked = visibleColumns.includes(col.key as K);
                return (
                  <button
                    key={col.key}
                    onClick={() => pick(col.key as K)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[13px] hover:bg-muted transition-colors"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <col.icon size={13} strokeWidth={1.75} className="text-subtle shrink-0" />
                      <span className="truncate">{col.label}</span>
                    </span>
                    {checked && <Check size={14} strokeWidth={2} className="shrink-0 text-accent" />}
                  </button>
                );
              })}
              {custom.length > 0 && (
                <>
                  <p className="px-3 pt-2 pb-1.5 text-[11px] font-medium text-subtle uppercase tracking-wide border-t border-border mt-1">
                    Custom fields
                  </p>
                  {custom.map((f) => {
                    const key = `custom:${f.id}` as K;
                    const checked = visibleColumns.includes(key);
                    return (
                      <button
                        key={f.id}
                        onClick={() => pick(key)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[13px] hover:bg-muted transition-colors"
                      >
                        <span className="truncate">{f.label}</span>
                        {checked && <Check size={14} strokeWidth={2} className="shrink-0 text-accent" />}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
            <Link
              href={customizeHref}
              className="flex items-center gap-2 px-3 py-2 text-[12.5px] text-subtle border-t border-border hover:bg-muted hover:text-foreground transition-colors"
            >
              <OptionsIcon size={13} strokeWidth={1.75} />
              Customize fields
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
