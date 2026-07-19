"use client";

import { useTransition } from "react";
import {
  Zap,
  FilePlus,
  RefreshCw,
  Trash2,
  FileEdit,
  Hand,
  Clock,
  Webhook,
} from "lucide-react";
import { setWorkflowTrigger } from "@/lib/actions/workflows";
import { type TriggerType } from "@/lib/workflow-triggers";

const DATA_TRIGGERS: { type: TriggerType; label: string; icon: typeof FilePlus }[] = [
  { type: "record_created", label: "Record is created", icon: FilePlus },
  { type: "record_updated", label: "Record is updated", icon: RefreshCw },
  { type: "record_deleted", label: "Record is deleted", icon: Trash2 },
  { type: "record_created_or_updated", label: "Record is created or updated", icon: FileEdit },
];

const OTHER_TRIGGERS: { type: TriggerType; label: string; icon: typeof Hand }[] = [
  { type: "manual", label: "Launch manually", icon: Hand },
  { type: "schedule", label: "On a schedule", icon: Clock },
  { type: "webhook", label: "Webhook", icon: Webhook },
];

const TRIGGER_LABELS: Record<TriggerType, string> = {
  record_created: "Record is created",
  record_updated: "Record is updated",
  record_deleted: "Record is deleted",
  record_created_or_updated: "Record is created or updated",
  manual: "Launch manually",
  schedule: "On a schedule",
  webhook: "Webhook",
};

export function WorkflowBuilder({
  workflowId,
  triggerType,
}: {
  workflowId: string;
  triggerType: string | null;
}) {
  const [pending, startTransition] = useTransition();

  function selectTrigger(type: TriggerType) {
    startTransition(() => setWorkflowTrigger(workflowId, type));
  }

  return (
    <div className="flex flex-1 min-h-0">
      <div className="flex-1 min-w-0 relative overflow-auto bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] bg-[length:20px_20px]">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-52 rounded-lg border border-accent bg-surface shadow-lg overflow-hidden">
            <div className="h-8 bg-accent/15 flex items-center gap-1.5 px-3">
              <Zap size={13} strokeWidth={2} className="text-accent" />
              <span className="text-[12px] font-medium text-accent">Trigger</span>
            </div>
            <div className="px-3 py-2.5 text-center text-[13px]">
              {triggerType ? TRIGGER_LABELS[triggerType as TriggerType] : "Add a Trigger"}
            </div>
          </div>
        </div>
      </div>

      <aside className="w-72 shrink-0 border-l border-border flex flex-col">
        <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-border">
          <span className="text-[13px] font-medium">Trigger Type</span>
        </div>

        <div className="flex-1 overflow-y-auto py-3">
          <p className="px-4 pb-1.5 text-[11px] font-medium text-subtle uppercase tracking-wide">Data</p>
          {DATA_TRIGGERS.map(({ type, label, icon: Icon }) => (
            <TriggerOption
              key={type}
              icon={Icon}
              label={label}
              selected={triggerType === type}
              disabled={pending}
              onClick={() => selectTrigger(type)}
            />
          ))}

          <p className="px-4 pt-3 pb-1.5 text-[11px] font-medium text-subtle uppercase tracking-wide">Others</p>
          {OTHER_TRIGGERS.map(({ type, label, icon: Icon }) => (
            <TriggerOption
              key={type}
              icon={Icon}
              label={label}
              selected={triggerType === type}
              disabled={pending}
              onClick={() => selectTrigger(type)}
            />
          ))}
        </div>
      </aside>
    </div>
  );
}

function TriggerOption({
  icon: Icon,
  label,
  selected,
  disabled,
  onClick,
}: {
  icon: typeof Hand;
  label: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-4 py-1.5 text-[13px] transition-colors disabled:opacity-50 ${
        selected ? "text-accent bg-accent/10" : "text-foreground hover:bg-muted"
      }`}
    >
      <Icon size={14} strokeWidth={1.75} className={selected ? "text-accent" : "text-subtle"} />
      {label}
    </button>
  );
}
