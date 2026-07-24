"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, GripVertical, Type, Hash, CalendarDays, ToggleLeft, ListChecks, Link2 } from "lucide-react";
import { listRelationTargetOptions, type FieldType, type FieldInput } from "@/lib/actions/objects";
import type { SavedField } from "@/components/object-builder-form";

export const FIELD_TYPES: { value: FieldType; label: string; icon: typeof Type }[] = [
  { value: "text", label: "Text", icon: Type },
  { value: "number", label: "Number", icon: Hash },
  { value: "date", label: "Date", icon: CalendarDays },
  { value: "boolean", label: "Checkbox", icon: ToggleLeft },
  { value: "select", label: "Dropdown", icon: ListChecks },
  { value: "relation", label: "Relation", icon: Link2 },
];

type DraftField = FieldInput & { _key: number };

let draftKeySeq = 0;

export function FieldsTab({
  mode,
  initialName,
  savedFields,
  objectDefinitionId,
  onCreate,
  onAddField,
  onFieldAdded,
  onDeleteField,
  onFieldDeleted,
}: {
  mode: "create" | "edit";
  initialName?: string;
  savedFields: SavedField[];
  objectDefinitionId?: string;
  onCreate?: (name: string, fields: FieldInput[]) => Promise<{ id: string; slug: string }>;
  onAddField?: (objectDefinitionId: string, field: FieldInput) => Promise<void>;
  onFieldAdded: (field: SavedField) => void;
  onDeleteField?: (fieldId: string) => Promise<void>;
  onFieldDeleted: (fieldId: string) => void;
}) {
  const [name, setName] = useState(initialName ?? "");
  const [draftFields, setDraftFields] = useState<DraftField[]>([]);
  const [relationOptions, setRelationOptions] = useState<{ value: string; label: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    listRelationTargetOptions(objectDefinitionId).then(setRelationOptions);
  }, [objectDefinitionId]);

  function addDraftField() {
    setDraftFields((prev) => [...prev, { _key: draftKeySeq++, label: "", type: "text", required: false }]);
  }

  function updateDraftField(key: number, patch: Partial<DraftField>) {
    setDraftFields((prev) => prev.map((f) => (f._key === key ? { ...f, ...patch } : f)));
  }

  function removeDraftField(key: number) {
    setDraftFields((prev) => prev.filter((f) => f._key !== key));
  }

  function handleCreate() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const object = await onCreate!(name, draftFields);
        router.push(`/objects/${object.slug}/edit`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function handleAddExistingField() {
    const draft = draftFields[draftFields.length - 1];
    if (!draft || !draft.label.trim()) {
      setError("Give the field a label first");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await onAddField!(objectDefinitionId!, draft);
        onFieldAdded({
          ...draft,
          id: draft._key.toString(),
          dependsOnFieldId: null,
          dependsOnValue: null,
          layoutX: null,
          layoutY: null,
          layoutW: null,
        });
        setDraftFields((prev) => prev.filter((f) => f._key !== draft._key));
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function handleDeleteSavedField(fieldId: string) {
    if (!confirm("Delete this field? Its values will be removed from every record.")) return;
    startTransition(async () => {
      await onDeleteField!(fieldId);
      onFieldDeleted(fieldId);
      router.refresh();
    });
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-6 overflow-auto h-full">
      {mode === "create" && (
        <div className="mb-8">
          <label className="block text-[12px] font-medium text-subtle mb-1.5">Object name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Products"
            className="w-full px-3 py-2 rounded-md border border-border text-[13px] outline-none bg-transparent placeholder:text-subtle focus:border-accent transition-colors"
          />
        </div>
      )}

      {mode === "edit" && savedFields.length > 0 && (
        <div className="mb-6">
          <p className="text-[12px] font-medium text-subtle mb-2">Existing fields</p>
          <div className="divide-y divide-border border border-border rounded-md">
            {savedFields.map((f) => {
              const type = FIELD_TYPES.find((t) => t.value === f.type)!;
              const Icon = type.icon;
              return (
                <div key={f.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Icon size={14} strokeWidth={1.5} className="text-subtle shrink-0" />
                  <span className="flex-1 min-w-0 text-[13px] truncate">{f.label}</span>
                  <span className="text-[11px] text-subtle shrink-0">{type.label}</span>
                  {f.required && <span className="text-[11px] text-subtle shrink-0">Required</span>}
                  <button
                    onClick={() => handleDeleteSavedField(f.id)}
                    disabled={pending}
                    className="p-1 rounded text-subtle hover:text-foreground transition-colors shrink-0"
                  >
                    <Trash2 size={13} strokeWidth={1.75} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-2 flex items-center justify-between">
        <p className="text-[12px] font-medium text-subtle">{mode === "create" ? "Fields" : "New field"}</p>
      </div>

      <div className="space-y-3">
        {(mode === "create" ? draftFields : draftFields.slice(-1)).map((f) => (
          <FieldRow
            key={f._key}
            field={f}
            relationOptions={relationOptions}
            onChange={(patch) => updateDraftField(f._key, patch)}
            onRemove={() => removeDraftField(f._key)}
          />
        ))}
      </div>

      {(mode === "edit" && draftFields.length === 0) || mode === "create" ? (
        <button
          onClick={addDraftField}
          className="mt-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[13px] text-subtle hover:bg-muted hover:text-foreground transition-colors"
        >
          <Plus size={14} strokeWidth={2} />
          Add field
        </button>
      ) : null}

      {error && <p className="text-[12px] text-red-400 mt-3">{error}</p>}

      <div className="mt-8 flex items-center gap-2">
        {mode === "create" ? (
          <button
            onClick={handleCreate}
            disabled={pending}
            className="px-3 py-1.5 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Create object
          </button>
        ) : (
          draftFields.length > 0 && (
            <button
              onClick={handleAddExistingField}
              disabled={pending}
              className="px-3 py-1.5 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Save field
            </button>
          )
        )}
      </div>
    </div>
  );
}

function FieldRow({
  field,
  relationOptions,
  onChange,
  onRemove,
}: {
  field: DraftField;
  relationOptions: { value: string; label: string }[];
  onChange: (patch: Partial<DraftField>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="border border-border rounded-md p-3 space-y-2">
      <div className="flex items-center gap-2">
        <GripVertical size={14} strokeWidth={1.5} className="text-subtle shrink-0" />
        <input
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Field label"
          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent placeholder:text-subtle focus:border-accent transition-colors"
        />
        <select
          value={field.type}
          onChange={(e) => onChange({ type: e.target.value as FieldType, relationTarget: null })}
          className="px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent focus:border-accent transition-colors"
        >
          {FIELD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <button onClick={onRemove} className="p-1.5 rounded text-subtle hover:text-foreground transition-colors shrink-0">
          <Trash2 size={13} strokeWidth={1.75} />
        </button>
      </div>

      {field.type === "select" && (
        <input
          value={(field.options ?? []).join(", ")}
          onChange={(e) => onChange({ options: e.target.value.split(",").map((s) => s.trim()) })}
          placeholder="Options, comma separated (e.g. Small, Medium, Large)"
          className="w-full px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent placeholder:text-subtle focus:border-accent transition-colors"
        />
      )}

      {field.type === "relation" && (
        <select
          value={field.relationTarget ?? ""}
          onChange={(e) => onChange({ relationTarget: e.target.value })}
          className="w-full px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent focus:border-accent transition-colors"
        >
          <option value="" disabled>
            Link to…
          </option>
          {relationOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}

      <label className="flex items-center gap-1.5 text-[12px] text-subtle cursor-pointer">
        <input type="checkbox" checked={!!field.required} onChange={(e) => onChange({ required: e.target.checked })} />
        Required
      </label>
    </div>
  );
}
