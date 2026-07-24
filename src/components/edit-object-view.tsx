"use client";

import type { FieldDefinition } from "@prisma/client";
import { ObjectBuilderForm } from "@/components/object-builder-form";
import { addFieldToObject, deleteField, type FieldType } from "@/lib/actions/objects";

export function EditObjectView({
  objectDefinitionId,
  name,
  fields,
}: {
  objectDefinitionId: string;
  name: string;
  fields: FieldDefinition[];
}) {
  return (
    <ObjectBuilderForm
      mode="edit"
      objectDefinitionId={objectDefinitionId}
      initialName={name}
      initialFields={fields.map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type as FieldType,
        options: f.options,
        required: f.required,
        relationTarget: f.relationTarget,
        dependsOnFieldId: f.dependsOnFieldId,
        dependsOnValue: f.dependsOnValue,
        layoutX: f.layoutX,
        layoutY: f.layoutY,
        layoutW: f.layoutW,
      }))}
      onAddField={addFieldToObject}
      onDeleteField={deleteField}
    />
  );
}
