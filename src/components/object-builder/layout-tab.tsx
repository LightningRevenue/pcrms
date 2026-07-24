"use client";

import { useRef, useState } from "react";
import { setFieldLayout } from "@/lib/actions/objects";
import type { SavedField } from "@/components/object-builder-form";

const DEFAULT_W = 220;
const CARD_H = 56;
const GRID = 8;

function snap(v: number) {
  return Math.round(v / GRID) * GRID;
}

function defaultPosition(index: number) {
  return { x: snap((index % 3) * 240 + 20), y: snap(Math.floor(index / 3) * 80 + 20) };
}

export function LayoutTab({ fields, onFieldUpdated }: { fields: SavedField[]; onFieldUpdated: (field: SavedField) => void }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  function positionOf(f: SavedField, index: number) {
    if (f.layoutX !== null && f.layoutY !== null) return { x: f.layoutX, y: f.layoutY, w: f.layoutW ?? DEFAULT_W };
    return { ...defaultPosition(index), w: DEFAULT_W };
  }

  function handlePointerDown(e: React.PointerEvent, field: SavedField, index: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = positionOf(field, index);
    const canvasRect = canvas.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - canvasRect.left - pos.x, y: e.clientY - canvasRect.top - pos.y };
    setDragId(field.id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent, field: SavedField) {
    if (dragId !== field.id) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    const x = Math.max(0, snap(e.clientX - canvasRect.left - dragOffset.current.x));
    const y = Math.max(0, snap(e.clientY - canvasRect.top - dragOffset.current.y));
    onFieldUpdated({ ...field, layoutX: x, layoutY: y, layoutW: field.layoutW ?? DEFAULT_W });
  }

  function handlePointerUp(field: SavedField) {
    if (dragId !== field.id) return;
    setDragId(null);
    setFieldLayout(field.id, field.layoutX ?? 0, field.layoutY ?? 0, field.layoutW ?? DEFAULT_W);
  }

  return (
    <div className="h-full flex flex-col">
      <p className="px-6 py-2 text-[12px] text-subtle border-b border-border">
        Drag fields anywhere to arrange the record form. This layout replaces the default list.
      </p>
      <div className="flex-1 min-h-0 overflow-auto p-6">
        <div ref={canvasRef} className="relative border border-dashed border-border rounded-md bg-muted/20" style={{ minHeight: 500 }}>
          {fields.map((f, i) => {
            const pos = positionOf(f, i);
            return (
              <div
                key={f.id}
                onPointerDown={(e) => handlePointerDown(e, f, i)}
                onPointerMove={(e) => handlePointerMove(e, f)}
                onPointerUp={() => handlePointerUp(f)}
                style={{ left: pos.x, top: pos.y, width: pos.w, height: CARD_H }}
                className={`absolute flex items-center px-3 rounded-md border border-border bg-background text-[13px] cursor-move select-none shadow-sm ${
                  dragId === f.id ? "ring-2 ring-accent z-10" : ""
                }`}
              >
                <span className="truncate">{f.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
