"use client";

import { ObjectBuilderForm } from "@/components/object-builder-form";
import { createObjectDefinition } from "@/lib/actions/objects";

export function NewObjectView() {
  return <ObjectBuilderForm mode="create" onCreate={createObjectDefinition} />;
}
