"use client";

import { useState, useTransition } from "react";
import { Plus, X, GripVertical } from "lucide-react";
import type { PipelineStage } from "@prisma/client";
import {
  createPipelineStage,
  updatePipelineStage,
  reorderPipelineStages,
  deletePipelineStage,
  countDealsInStage,
  type StageOutcome,
} from "@/lib/actions/pipeline-stages";

const OUTCOME_LABELS: Record<StageOutcome, string> = {
  open: "Open",
  won: "Closed won",
  lost: "Closed lost",
};

const OUTCOME_BADGE: Record<StageOutcome, string> = {
  open: "bg-blue-500 text-white",
  won: "bg-emerald-500 text-white",
  lost: "bg-rose-500 text-white",
};

export function PipelineStagesManager({
  stages: initial,
  itemNounPlural = "deals",
  actions = {
    create: createPipelineStage,
    update: updatePipelineStage,
    reorder: reorderPipelineStages,
    countInStage: countDealsInStage,
    remove: deletePipelineStage,
  },
}: {
  stages: PipelineStage[];
  // Label for the RemapDialog copy ("Deals are still on X" vs "Contacts are still on X").
  itemNounPlural?: string;
  actions?: {
    create: (label: string, outcome: StageOutcome) => Promise<PipelineStage>;
    update: (id: string, data: { label?: string; outcome?: StageOutcome }) => Promise<void>;
    reorder: (orderedIds: string[]) => Promise<void>;
    countInStage: (label: string) => Promise<number>;
    remove: (id: string, remapToLabel?: string) => Promise<void>;
  };
}) {
  const [stages, setStages] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PipelineStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleReorder(draggedId: string, overId: string) {
    if (draggedId === overId) return;
    setStages((prev) => {
      const next = [...prev];
      const from = next.findIndex((s) => s.id === draggedId);
      const to = next.findIndex((s) => s.id === overId);
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      startTransition(() => actions.reorder(next.map((s) => s.id)));
      return next;
    });
  }

  function handleUpdate(id: string, data: { label?: string; outcome?: StageOutcome }) {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
    startTransition(() => actions.update(id, data));
  }

  async function handleDeleteClick(stage: PipelineStage) {
    const count = await actions.countInStage(stage.label);
    if (count > 0) {
      setDeleteTarget(stage);
    } else {
      setStages((prev) => prev.filter((s) => s.id !== stage.id));
      startTransition(() => actions.remove(stage.id));
    }
  }

  function handleCreate(label: string, outcome: StageOutcome) {
    setError(null);
    startTransition(async () => {
      try {
        const stage = await actions.create(label, outcome);
        setStages((prev) => [...prev, stage]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-medium text-subtle uppercase tracking-wide">Stages</p>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors"
        >
          <Plus size={14} strokeWidth={1.75} />
          Add stage
        </button>
      </div>

      {error && <p className="text-[12px] text-red-400 mt-2">{error}</p>}

      <div className="mt-2 border border-border rounded-md overflow-hidden">
        {stages.map((stage) => (
          <StageRow
            key={stage.id}
            stage={stage}
            dragging={dragId === stage.id}
            onDragStart={() => setDragId(stage.id)}
            onDragOver={() => dragId && handleReorder(dragId, stage.id)}
            onDragEnd={() => setDragId(null)}
            onUpdate={(data) => handleUpdate(stage.id, data)}
            onDelete={() => handleDeleteClick(stage)}
          />
        ))}
        {adding && <NewStageRow onDone={() => setAdding(false)} onCreate={handleCreate} />}
        {stages.length === 0 && !adding && (
          <div className="px-3 py-4 text-[13px] text-subtle text-center">No stages yet</div>
        )}
      </div>

      {deleteTarget && (
        <RemapDialog
          stage={deleteTarget}
          otherStages={stages.filter((s) => s.id !== deleteTarget.id)}
          itemNounPlural={itemNounPlural}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={(remapToLabel) => {
            setStages((prev) => prev.filter((s) => s.id !== deleteTarget.id));
            startTransition(() => actions.remove(deleteTarget.id, remapToLabel));
            setDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
}

function StageRow({
  stage,
  dragging,
  onDragStart,
  onDragOver,
  onDragEnd,
  onUpdate,
  onDelete,
}: {
  stage: PipelineStage;
  dragging: boolean;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragEnd: () => void;
  onUpdate: (data: { label?: string; outcome?: StageOutcome }) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(stage.label);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-2.5 px-3 py-2 text-[13px] border-b border-border last:border-b-0 group ${
        dragging ? "opacity-40" : ""
      }`}
    >
      <GripVertical size={14} strokeWidth={1.75} className="opacity-40 shrink-0 cursor-grab active:cursor-grabbing" />
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => label.trim() && label !== stage.label && onUpdate({ label })}
        className="flex-1 min-w-0 bg-transparent outline-none border-b border-transparent hover:border-border focus:border-accent transition-colors py-0.5"
      />
      <select
        value={stage.outcome}
        onChange={(e) => onUpdate({ outcome: e.target.value as StageOutcome })}
        className={`text-[12px] font-medium rounded-full px-2 py-0.5 outline-none cursor-pointer ${OUTCOME_BADGE[stage.outcome as StageOutcome] ?? "bg-muted"}`}
      >
        {(Object.entries(OUTCOME_LABELS) as [StageOutcome, string][]).map(([value, text]) => (
          <option key={value} value={value} className="bg-background text-foreground">
            {text}
          </option>
        ))}
      </select>
      <button
        onClick={onDelete}
        className="p-1 rounded text-subtle opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity"
        title="Delete stage"
      >
        <X size={13} strokeWidth={1.75} />
      </button>
    </div>
  );
}

function NewStageRow({
  onDone,
  onCreate,
}: {
  onDone: () => void;
  onCreate: (label: string, outcome: StageOutcome) => void;
}) {
  const [label, setLabel] = useState("");
  const [outcome, setOutcome] = useState<StageOutcome>("open");

  function submit() {
    if (!label.trim()) return onDone();
    onCreate(label.trim(), outcome);
    onDone();
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 text-[13px]">
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Stage name"
        onKeyDown={(e) => e.key === "Enter" && submit()}
        className="flex-1 min-w-0 bg-transparent outline-none border-b border-border placeholder:text-subtle"
      />
      <select
        value={outcome}
        onChange={(e) => setOutcome(e.target.value as StageOutcome)}
        className="bg-transparent outline-none border-b border-border text-subtle"
      >
        {(Object.entries(OUTCOME_LABELS) as [StageOutcome, string][]).map(([value, text]) => (
          <option key={value} value={value} className="bg-background text-foreground">
            {text}
          </option>
        ))}
      </select>
      <button onClick={submit} className="px-2 py-1 rounded-md bg-foreground text-background text-[12px]">
        Add
      </button>
      <button onClick={onDone} className="p-1 text-subtle hover:text-foreground transition-colors">
        <X size={14} strokeWidth={1.75} />
      </button>
    </div>
  );
}

function RemapDialog({
  stage,
  otherStages,
  itemNounPlural,
  onCancel,
  onConfirm,
}: {
  stage: PipelineStage;
  otherStages: PipelineStage[];
  itemNounPlural: string;
  onCancel: () => void;
  onConfirm: (remapToLabel: string) => void;
}) {
  const [target, setTarget] = useState(otherStages[0]?.label ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-96 rounded-lg border border-border bg-background shadow-2xl p-5">
        <h2 className="text-[15px] font-medium">Move {itemNounPlural} before deleting</h2>
        <p className="text-[13px] text-subtle mt-1.5">
          {itemNounPlural.charAt(0).toUpperCase() + itemNounPlural.slice(1)} are still on{" "}
          <span className="font-medium text-foreground">{stage.label}</span>. Choose where to move them before this
          stage is deleted.
        </p>

        {otherStages.length === 0 ? (
          <p className="text-[13px] text-red-400 mt-4">Create another stage first — there&apos;s nowhere to move these deals.</p>
        ) : (
          <label className="block mt-4">
            <span className="text-[12px] text-subtle">Move deals to</span>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="mt-1 w-full text-[13px] outline-none bg-transparent border-b border-border focus:border-accent transition-colors py-1.5"
            >
              {otherStages.map((s) => (
                <option key={s.id} value={s.label} className="bg-background text-foreground">
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md text-[13px] text-subtle hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => target && onConfirm(target)}
            disabled={!target}
            className="px-3 py-1.5 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Move & delete
          </button>
        </div>
      </div>
    </div>
  );
}
