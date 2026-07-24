"use client";

import { useState } from "react";
import { ListChecks, GitBranch, LayoutTemplate } from "lucide-react";
import type { FieldInput } from "@/lib/actions/objects";
import { FieldsTab } from "@/components/object-builder/fields-tab";
import { DependenciesTab } from "@/components/object-builder/dependencies-tab";
import { LayoutTab } from "@/components/object-builder/layout-tab";

export type SavedField = FieldInput & {
  id: string;
  dependsOnFieldId: string | null;
  dependsOnValue: string | null;
  layoutX: number | null;
  layoutY: number | null;
  layoutW: number | null;
};

type BuilderTab = "fields" | "dependencies" | "layout";

export function ObjectBuilderForm({
  mode,
  objectDefinitionId,
  initialName,
  initialFields,
  onCreate,
  onAddField,
  onDeleteField,
}: {
  mode: "create" | "edit";
  objectDefinitionId?: string;
  initialName?: string;
  initialFields?: SavedField[];
  onCreate?: (name: string, fields: FieldInput[]) => Promise<{ id: string; slug: string }>;
  onAddField?: (objectDefinitionId: string, field: FieldInput) => Promise<void>;
  onDeleteField?: (fieldId: string) => Promise<void>;
}) {
  const [tab, setTab] = useState<BuilderTab>("fields");
  const [savedFields, setSavedFields] = useState<SavedField[]>(initialFields ?? []);

  const canUseCanvases = mode === "edit";

  return (
    <div className="flex flex-col h-screen">
      <div className="h-11 shrink-0 flex items-center gap-1 px-6 border-b border-border">
        <TabButton active={tab === "fields"} onClick={() => setTab("fields")} icon={ListChecks} label="Fields" />
        <TabButton
          active={tab === "dependencies"}
          onClick={() => canUseCanvases && setTab("dependencies")}
          icon={GitBranch}
          label="Dependencies"
          disabled={!canUseCanvases}
        />
        <TabButton
          active={tab === "layout"}
          onClick={() => canUseCanvases && setTab("layout")}
          icon={LayoutTemplate}
          label="Layout"
          disabled={!canUseCanvases}
        />
      </div>

      <div className="flex-1 min-h-0">
        {tab === "fields" && (
          <FieldsTab
            mode={mode}
            initialName={initialName}
            savedFields={savedFields}
            onCreate={onCreate}
            onAddField={onAddField}
            onFieldAdded={(f) => setSavedFields((prev) => [...prev, f])}
            onDeleteField={onDeleteField}
            onFieldDeleted={(id) => setSavedFields((prev) => prev.filter((f) => f.id !== id))}
            objectDefinitionId={objectDefinitionId}
          />
        )}
        {tab === "dependencies" && canUseCanvases && (
          <DependenciesTab fields={savedFields} onFieldUpdated={(f) => setSavedFields((prev) => prev.map((p) => (p.id === f.id ? f : p)))} />
        )}
        {tab === "layout" && canUseCanvases && (
          <LayoutTab fields={savedFields} onFieldUpdated={(f) => setSavedFields((prev) => prev.map((p) => (p.id === f.id ? f : p)))} />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof ListChecks;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "Save the object first" : undefined}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] transition-colors ${
        active ? "bg-muted text-foreground font-medium" : "text-subtle hover:text-foreground"
      } disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-subtle`}
    >
      <Icon size={14} strokeWidth={1.5} />
      {label}
    </button>
  );
}
