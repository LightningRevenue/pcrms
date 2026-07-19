"use client";

import { SlidersHorizontal } from "lucide-react";
import { FieldSection } from "@/components/field-section";
import { EditableFieldRow } from "@/components/editable-field-row";
import { setCustomFieldValue, type ObjectType, type CustomFieldType } from "@/lib/actions/custom-fields";

type CustomFieldValue = {
  id: string;
  label: string;
  type: CustomFieldType;
  options: string[];
  value: string;
};

const TYPE_MAP: Record<CustomFieldType, "text" | "number" | "date" | "select"> = {
  TEXT: "text",
  NUMBER: "number",
  DATE: "date",
  SELECT: "select",
};

export function CustomFieldsSection({
  objectType,
  recordId,
  fields,
}: {
  objectType: ObjectType;
  recordId: string;
  fields: CustomFieldValue[];
}) {
  if (fields.length === 0) return null;

  return (
    <FieldSection title="Custom fields">
      {fields.map((f) => (
        <EditableFieldRow
          key={f.id}
          icon={SlidersHorizontal}
          label={f.label}
          value={f.value}
          type={TYPE_MAP[f.type]}
          options={f.options}
          onSave={(v) => setCustomFieldValue(objectType, f.id, recordId, v)}
        />
      ))}
    </FieldSection>
  );
}
