"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  type Node,
  type Edge,
  type NodeChange,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { setFieldDependency } from "@/lib/actions/objects";
import type { SavedField } from "@/components/object-builder-form";

const COLS = 4;
const COL_WIDTH = 220;
const ROW_HEIGHT = 100;

function defaultPosition(index: number) {
  return { x: (index % COLS) * COL_WIDTH + 40, y: Math.floor(index / COLS) * ROW_HEIGHT + 40 };
}

export function DependenciesTab({
  fields,
  onFieldUpdated,
}: {
  fields: SavedField[];
  onFieldUpdated: (field: SavedField) => void;
}) {
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [editingEdge, setEditingEdge] = useState<{ source: string; target: string } | null>(null);

  const nodes: Node[] = useMemo(
    () =>
      fields.map((f, i) => ({
        id: f.id,
        position: positions[f.id] ?? defaultPosition(i),
        data: { label: f.label },
        style: {
          border: "2px solid red",
          borderRadius: 8,
          padding: "8px 12px",
          fontSize: 13,
          background: "yellow",
          color: "black",
          width: 160,
        },
      })),
    [fields, positions]
  );

  const edges: Edge[] = useMemo(
    () =>
      fields
        .filter((f) => f.dependsOnFieldId)
        .map((f) => ({
          id: `${f.dependsOnFieldId}-${f.id}`,
          source: f.dependsOnFieldId!,
          target: f.id,
          label: f.dependsOnValue ? `= ${f.dependsOnValue}` : "has value",
          markerEnd: { type: MarkerType.ArrowClosed },
        })),
    [fields]
  );

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    setPositions((prev) => {
      const next = { ...prev };
      for (const c of changes) {
        if (c.type === "position" && c.position) next[c.id] = c.position;
      }
      return next;
    });
  }, []);

  function handleConnect(connection: Connection) {
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    setEditingEdge({ source: connection.source, target: connection.target });
  }

  function removeDependency(fieldId: string) {
    setFieldDependency(fieldId, null, null).then(() => {
      const field = fields.find((f) => f.id === fieldId);
      if (field) onFieldUpdated({ ...field, dependsOnFieldId: null, dependsOnValue: null });
    });
  }

  return (
    <div className="h-full flex flex-col">
      <p className="px-6 py-2 text-[12px] text-subtle border-b border-border">
        Drag from one field to another: the target only appears on the form once the source has a value. Click an
        arrow to edit or remove it.
      </p>
      <div style={{ width: "100vw", height: "100vh" }}>
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={handleNodesChange} onConnect={handleConnect}>
          <Background />
          <Controls />
        </ReactFlow>
      </div>

      {editingEdge && (
        <EdgeConditionDialog
          fields={fields}
          source={editingEdge.source}
          target={editingEdge.target}
          onClose={() => setEditingEdge(null)}
          onSave={(value) => {
            setFieldDependency(editingEdge.target, editingEdge.source, value).then(() => {
              const field = fields.find((f) => f.id === editingEdge.target);
              if (field) onFieldUpdated({ ...field, dependsOnFieldId: editingEdge.source, dependsOnValue: value });
              setEditingEdge(null);
            });
          }}
          onRemove={() => {
            removeDependency(editingEdge.target);
            setEditingEdge(null);
          }}
        />
      )}
    </div>
  );
}

function EdgeConditionDialog({
  fields,
  source,
  target,
  onClose,
  onSave,
  onRemove,
}: {
  fields: SavedField[];
  source: string;
  target: string;
  onClose: () => void;
  onSave: (value: string | null) => void;
  onRemove: () => void;
}) {
  const sourceField = fields.find((f) => f.id === source)!;
  const targetField = fields.find((f) => f.id === target)!;
  const existing = targetField.dependsOnFieldId === source ? targetField.dependsOnValue : null;
  const [mode, setMode] = useState<"any" | "equals">(existing ? "equals" : "any");
  const [value, setValue] = useState(existing ?? sourceField.options?.[0] ?? "");

  const hasOptions = sourceField.type === "select" && (sourceField.options?.length ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20" onClick={onClose}>
      <div className="w-80 bg-background border border-border rounded-md p-4" onClick={(e) => e.stopPropagation()}>
        <p className="text-[13px] font-medium mb-1">
          {targetField.label} depends on {sourceField.label}
        </p>
        <p className="text-[12px] text-subtle mb-3">Choose when {targetField.label} should appear on the form.</p>

        <div className="space-y-2 mb-4">
          <label className="flex items-center gap-2 text-[13px] cursor-pointer">
            <input type="radio" checked={mode === "any"} onChange={() => setMode("any")} />
            Has any value
          </label>
          <label className="flex items-center gap-2 text-[13px] cursor-pointer">
            <input type="radio" checked={mode === "equals"} onChange={() => setMode("equals")} />
            Equals…
          </label>
          {mode === "equals" &&
            (hasOptions ? (
              <select
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full ml-6 px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent"
              >
                {sourceField.options!.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : sourceField.type === "boolean" ? (
              <select
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full ml-6 px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent"
              >
                <option value="true">Checked</option>
                <option value="false">Unchecked</option>
              </select>
            ) : (
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Value"
                className="w-full ml-6 px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent"
              />
            ))}
        </div>

        <div className="flex items-center justify-between">
          {existing !== null || targetField.dependsOnFieldId === source ? (
            <button onClick={onRemove} className="text-[13px] text-red-400 hover:underline">
              Remove
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-2.5 py-1 rounded-md text-[13px] text-subtle hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              onClick={() => onSave(mode === "equals" ? value : null)}
              className="px-2.5 py-1 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
