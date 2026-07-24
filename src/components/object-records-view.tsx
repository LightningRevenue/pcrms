"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { FieldDefinition } from "@prisma/client";
import { Boxes, Plus, Trash2, Settings2, X, Search } from "lucide-react";
import {
  createObjectRecord,
  updateObjectRecord,
  deleteObjectRecord,
  searchRelationCandidates,
  type ObjectRecordRow,
  type FieldType,
} from "@/lib/actions/objects";

type ObjectWithFields = {
  id: string;
  slug: string;
  name: string;
  namePlural: string;
  fields: FieldDefinition[];
};

// A field with a dependsOnField condition is hidden until its parent's current form value
// satisfies that condition — mirrors coerceValues' server-side skip logic in objects.ts.
function isFieldVisible(field: FieldDefinition, byId: Map<string, FieldDefinition>, values: Record<string, unknown>): boolean {
  if (!field.dependsOnFieldId) return true;
  const parent = byId.get(field.dependsOnFieldId);
  if (!parent) return true;
  const parentValue = values[parent.key];
  if (field.dependsOnValue) return String(parentValue ?? "") === field.dependsOnValue;
  return parentValue !== undefined && parentValue !== null && parentValue !== "";
}

function displayValue(field: FieldDefinition, row: ObjectRecordRow): string {
  const raw = row.values[field.key];
  if (raw === undefined || raw === null || raw === "") return "—";
  if (field.type === "relation") return row.relationLabels[field.key] ?? "—";
  if (field.type === "boolean") return raw ? "Yes" : "No";
  if (field.type === "date") return new Date(raw as string).toLocaleDateString();
  return String(raw);
}

export function ObjectRecordsView({ object, records: initial }: { object: ObjectWithFields; records: ObjectRecordRow[] }) {
  const [records, setRecords] = useState(initial);
  const [editing, setEditing] = useState<ObjectRecordRow | "new" | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function refresh() {
    router.refresh();
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this record?")) return;
    setRecords((prev) => prev.filter((r) => r.id !== id));
    startTransition(async () => {
      await deleteObjectRecord(id);
      refresh();
    });
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="h-12 shrink-0 flex items-center justify-between px-6 border-b border-border">
        <div className="flex items-center gap-2 text-[13px]">
          <Link href="/objects" className="text-subtle hover:text-foreground transition-colors">
            <Boxes size={14} strokeWidth={1.75} />
          </Link>
          <span className="text-subtle">/</span>
          <span className="font-medium">{object.namePlural}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/objects/${object.slug}/edit`}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] text-subtle hover:bg-muted hover:text-foreground transition-colors"
          >
            <Settings2 size={14} strokeWidth={1.75} />
            Edit fields
          </Link>
          <button
            onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity"
          >
            <Plus size={14} strokeWidth={2} />
            New {object.name}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {object.fields.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <p className="text-[13px] text-subtle">No fields yet.</p>
            <Link href={`/objects/${object.slug}/edit`} className="text-[13px] text-accent mt-1 hover:underline">
              Add fields
            </Link>
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <Boxes size={24} strokeWidth={1.5} className="text-subtle" />
            <p className="text-[13px] text-subtle mt-3">No {object.namePlural.toLowerCase()} yet.</p>
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border">
                {object.fields.map((f) => (
                  <th key={f.id} className="text-left font-medium text-subtle px-6 py-2 whitespace-nowrap">
                    {f.label}
                  </th>
                ))}
                <th className="w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-muted/40 transition-colors cursor-pointer" onClick={() => setEditing(r)}>
                  {object.fields.map((f) => (
                    <td key={f.id} className="px-6 py-2.5 whitespace-nowrap">
                      {displayValue(f, r)}
                    </td>
                  ))}
                  <td className="px-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(r.id);
                      }}
                      className="p-1 rounded text-subtle hover:text-foreground transition-colors"
                    >
                      <Trash2 size={13} strokeWidth={1.75} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <RecordFormPanel
          object={object}
          record={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function RecordFormPanel({
  object,
  record,
  onClose,
  onSaved,
}: {
  object: ObjectWithFields;
  record: ObjectRecordRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() => (record ? { ...record.values } : {}));
  const [relationLabels, setRelationLabels] = useState<Record<string, string | null>>(() => record?.relationLabels ?? {});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fieldsById = new Map(object.fields.map((f) => [f.id, f]));
  const hasCustomLayout = object.fields.some((f) => f.layoutX !== null && f.layoutY !== null);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        if (record) await updateObjectRecord(record.id, values);
        else await createObjectRecord(object.id, values);
        onSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20" onClick={onClose}>
      <div className="w-96 h-full bg-background border-l border-border flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-border">
          <span className="text-[13px] font-medium">{record ? `Edit ${object.name}` : `New ${object.name}`}</span>
          <button onClick={onClose} className="p-1 rounded text-subtle hover:text-foreground transition-colors">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className={`flex-1 min-h-0 overflow-auto p-4 ${hasCustomLayout ? "relative" : "space-y-4"}`}>
          {object.fields
            .filter((f) => isFieldVisible(f, fieldsById, values))
            .map((f) => (
              <div
                key={f.id}
                style={
                  hasCustomLayout && f.layoutX !== null && f.layoutY !== null
                    ? { position: "absolute", left: f.layoutX, top: f.layoutY, width: f.layoutW ?? 220 }
                    : undefined
                }
              >
                <FieldInputRow
                  field={f}
                  value={values[f.key]}
                  relationLabel={relationLabels[f.key] ?? null}
                  onChange={(v, label) => {
                    setValues((prev) => ({ ...prev, [f.key]: v }));
                    if (label !== undefined) setRelationLabels((prev) => ({ ...prev, [f.key]: label }));
                  }}
                />
              </div>
            ))}
        </div>

        {error && <p className="px-4 pb-2 text-[12px] text-red-400">{error}</p>}

        <div className="p-4 border-t border-border">
          <button
            onClick={handleSave}
            disabled={pending}
            className="w-full px-3 py-1.5 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {record ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldInputRow({
  field,
  value,
  relationLabel,
  onChange,
}: {
  field: FieldDefinition;
  value: unknown;
  relationLabel: string | null;
  onChange: (value: unknown, label?: string | null) => void;
}) {
  const type = field.type as FieldType;

  return (
    <div>
      <label className="block text-[12px] font-medium text-subtle mb-1.5">
        {field.label}
        {field.required && <span className="text-red-400"> *</span>}
      </label>

      {type === "text" && (
        <input
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent focus:border-accent transition-colors"
        />
      )}
      {type === "number" && (
        <input
          type="number"
          value={(value as number) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent focus:border-accent transition-colors"
        />
      )}
      {type === "date" && (
        <input
          type="date"
          value={value ? new Date(value as string).toISOString().slice(0, 10) : ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent focus:border-accent transition-colors"
        />
      )}
      {type === "boolean" && (
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
      )}
      {type === "select" && (
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent focus:border-accent transition-colors"
        >
          <option value="">—</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )}
      {type === "relation" && (
        <RelationPicker
          target={field.relationTarget!}
          value={(value as string) ?? null}
          label={relationLabel}
          onChange={(id, label) => onChange(id, label)}
        />
      )}
    </div>
  );
}

function RelationPicker({
  target,
  value,
  label,
  onChange,
}: {
  target: string;
  value: string | null;
  label: string | null;
  onChange: (id: string | null, label: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    searchRelationCandidates(target, query).then(setRows);
  }, [open, target, query]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md border border-border text-[13px] hover:border-accent transition-colors text-left"
      >
        <span className={value ? "" : "text-subtle"}>{value ? label ?? "Selected" : "Choose…"}</span>
        {value && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null, null);
            }}
            className="text-subtle hover:text-foreground"
          >
            <X size={13} strokeWidth={1.75} />
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="border border-border rounded-md">
      <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-border">
        <Search size={13} strokeWidth={1.5} className="text-subtle shrink-0" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="flex-1 min-w-0 text-[13px] outline-none bg-transparent placeholder:text-subtle"
        />
        <button onClick={() => setOpen(false)} className="text-subtle hover:text-foreground">
          <X size={13} strokeWidth={1.75} />
        </button>
      </div>
      <div className="max-h-48 overflow-auto">
        {rows.length === 0 ? (
          <p className="text-[12px] text-subtle text-center py-3">No results.</p>
        ) : (
          rows.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                onChange(r.id, r.label);
                setOpen(false);
              }}
              className="w-full text-left px-2.5 py-1.5 text-[13px] hover:bg-muted/40 transition-colors"
            >
              {r.label}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
