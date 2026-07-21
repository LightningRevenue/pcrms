"use client";

import { useState, useTransition } from "react";
import { Plus, X, GripVertical } from "lucide-react";
import type { CustomFieldDefinition } from "@prisma/client";
import {
  createFieldDefinition,
  deleteFieldDefinition,
  type ObjectType,
  type CustomFieldType,
} from "@/lib/actions/custom-fields";

const TYPE_LABELS: Record<CustomFieldType, string> = {
  TEXT: "Text",
  NUMBER: "Number",
  DATE: "Date",
  SELECT: "Select",
};

export function ObjectFieldsManager({
  objectType,
  standardFields,
  customFields,
  canCreate = true,
}: {
  objectType: ObjectType;
  standardFields: string[];
  customFields: CustomFieldDefinition[];
  canCreate?: boolean;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="mt-6">
      <p className="text-[12px] font-medium text-subtle uppercase tracking-wide">Standard fields</p>
      <div className="mt-2 border border-border rounded-md overflow-hidden">
        {standardFields.map((label) => (
          <div
            key={label}
            className="flex items-center gap-2.5 px-3 py-2 text-[13px] border-b border-border last:border-b-0 text-subtle"
          >
            <GripVertical size={14} strokeWidth={1.75} className="opacity-40" />
            {label}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-6">
        <p className="text-[12px] font-medium text-subtle uppercase tracking-wide">Custom fields</p>
        {canCreate ? (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors"
          >
            <Plus size={14} strokeWidth={1.75} />
            Add field
          </button>
        ) : (
          <span className="text-[12px] text-subtle" title="Custom fields aren't available on your current plan">
            Not available on your plan
          </span>
        )}
      </div>

      <div className="mt-2 border border-border rounded-md overflow-hidden">
        {customFields.length === 0 && !adding && (
          <div className="px-3 py-4 text-[13px] text-subtle text-center">No custom fields yet</div>
        )}
        {customFields.map((field) => (
          <FieldRow key={field.id} field={field} />
        ))}
        {adding && <NewFieldRow objectType={objectType} onDone={() => setAdding(false)} />}
      </div>
    </div>
  );
}

function FieldRow({ field }: { field: CustomFieldDefinition }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 text-[13px] border-b border-border last:border-b-0 group">
      <GripVertical size={14} strokeWidth={1.75} className="opacity-40 shrink-0" />
      <span className="flex-1 min-w-0 truncate">{field.label}</span>
      <span className="text-subtle text-[12px]">{TYPE_LABELS[field.type as CustomFieldType]}</span>
      <button
        onClick={() => startTransition(() => deleteFieldDefinition(field.id))}
        disabled={pending}
        className="p-1 rounded text-subtle opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity disabled:opacity-50"
        title="Delete field"
      >
        <X size={13} strokeWidth={1.75} />
      </button>
    </div>
  );
}

function NewFieldRow({ objectType, onDone }: { objectType: ObjectType; onDone: () => void }) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<CustomFieldType>("TEXT");
  const [options, setOptions] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!label.trim()) return onDone();
    startTransition(async () => {
      await createFieldDefinition(
        objectType,
        label,
        type,
        type === "SELECT" ? options.split(",").map((o) => o.trim()).filter(Boolean) : undefined
      );
      onDone();
    });
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 text-[13px]">
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Field name"
        className="flex-1 min-w-0 bg-transparent outline-none border-b border-border placeholder:text-subtle"
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as CustomFieldType)}
        className="bg-transparent outline-none border-b border-border text-subtle"
      >
        {Object.entries(TYPE_LABELS).map(([value, text]) => (
          <option key={value} value={value} className="bg-background text-foreground">
            {text}
          </option>
        ))}
      </select>
      {type === "SELECT" && (
        <input
          value={options}
          onChange={(e) => setOptions(e.target.value)}
          placeholder="Option A, Option B"
          className="w-40 bg-transparent outline-none border-b border-border placeholder:text-subtle"
        />
      )}
      <button
        onClick={submit}
        disabled={pending}
        className="px-2 py-1 rounded-md bg-foreground text-background text-[12px] disabled:opacity-50"
      >
        Add
      </button>
      <button onClick={onDone} className="p-1 text-subtle hover:text-foreground transition-colors">
        <X size={14} strokeWidth={1.75} />
      </button>
    </div>
  );
}
