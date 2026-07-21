"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Star, Trash2 } from "lucide-react";
import {
  createPlan,
  deletePlan,
  setDefaultPlan,
  getPlanEditorRows,
  updatePlanLimit,
  updatePlanStripePrice,
} from "@/lib/actions/plans";
import type { EntitlementKey } from "@/lib/entitlements";

type Plan = {
  id: string;
  name: string;
  isDefault: boolean;
  stripePriceId: string | null;
  limits: { key: string; value: number | null }[];
  _count: { workspaces: number };
};

type EditorRow = {
  key: string;
  label: string;
  type: "count" | "monthly" | "feature";
  value: number | null;
  hasRow: boolean;
};

const TYPE_LABEL: Record<EditorRow["type"], string> = {
  count: "Max total",
  monthly: "Max per month",
  feature: "Enabled",
};

export function PlanManager({ plans: initialPlans }: { plans: Plan[] }) {
  const [plans, setPlans] = useState(initialPlans);
  const [activeId, setActiveId] = useState<string | null>(initialPlans[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [, startTransition] = useTransition();

  const active = plans.find((p) => p.id === activeId) ?? null;

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      const plan = await createPlan(name);
      setPlans((prev) => [...prev, { ...plan, limits: [], _count: { workspaces: 0 } }]);
      setActiveId(plan.id);
      setNewName("");
      setCreating(false);
    });
  }

  function handleDelete(plan: Plan) {
    if (plan._count.workspaces > 0) {
      alert("Reassign every workspace on this plan before deleting it.");
      return;
    }
    if (!confirm(`Delete plan "${plan.name}"?`)) return;
    startTransition(async () => {
      await deletePlan(plan.id);
      setPlans((prev) => prev.filter((p) => p.id !== plan.id));
      setActiveId((cur) => (cur === plan.id ? plans.find((p) => p.id !== plan.id)?.id ?? null : cur));
    });
  }

  function handleSetDefault(planId: string) {
    startTransition(async () => {
      await setDefaultPlan(planId);
      setPlans((prev) => prev.map((p) => ({ ...p, isDefault: p.id === planId })));
    });
  }

  return (
    <div className="mt-6">
      <div className="flex items-center gap-1.5 flex-wrap">
        {plans.map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveId(p.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] border transition-colors ${
              activeId === p.id ? "bg-muted border-border text-foreground" : "border-transparent text-subtle hover:bg-muted hover:text-foreground"
            }`}
          >
            {p.isDefault && <Star size={12} strokeWidth={2} className="fill-current" />}
            {p.name}
            <span className="text-subtle">· {p._count.workspaces}</span>
          </button>
        ))}
        {creating ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Plan name"
              className="px-2.5 py-1.5 rounded-md border border-border bg-background text-[13px] outline-none focus:border-accent transition-colors w-32"
            />
            <button onClick={handleCreate} className="px-2.5 py-1.5 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity">
              Add
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[13px] text-subtle hover:bg-muted hover:text-foreground transition-colors"
          >
            <Plus size={14} strokeWidth={1.75} />
            New plan
          </button>
        )}
      </div>

      {active && (
        <div className="mt-6 border border-border rounded-lg">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <p className="text-[14px] font-medium">{active.name}</p>
              <p className="text-[12px] text-subtle">{active._count.workspaces} workspace{active._count.workspaces === 1 ? "" : "s"}</p>
            </div>
            <div className="flex items-center gap-2">
              {!active.isDefault && (
                <button
                  onClick={() => handleSetDefault(active.id)}
                  className="text-[12px] text-subtle hover:text-foreground transition-colors"
                >
                  Set as default
                </button>
              )}
              {!active.isDefault && (
                <button
                  onClick={() => handleDelete(active)}
                  className="p-1.5 rounded-md text-subtle hover:bg-red-500/10 hover:text-red-500 transition-colors"
                  title="Delete plan"
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                </button>
              )}
            </div>
          </div>

          <StripePriceEditor
            key={`price-${active.id}`}
            planId={active.id}
            stripePriceId={active.stripePriceId}
            onChange={(value) => setPlans((prev) => prev.map((p) => (p.id === active.id ? { ...p, stripePriceId: value } : p)))}
          />

          <PlanLimitsEditor key={active.id} planId={active.id} />
        </div>
      )}

      {plans.length === 0 && !creating && (
        <p className="mt-6 text-[13px] text-subtle">No plans yet — create one to start assigning limits.</p>
      )}
    </div>
  );
}

function StripePriceEditor({
  planId,
  stripePriceId,
  onChange,
}: {
  planId: string;
  stripePriceId: string | null;
  onChange: (value: string | null) => void;
}) {
  const [value, setValue] = useState(stripePriceId ?? "");
  const [, startTransition] = useTransition();

  function save() {
    const trimmed = value.trim() || null;
    onChange(trimmed);
    startTransition(() => updatePlanStripePrice(planId, trimmed));
  }

  return (
    <div className="px-4 py-3 border-b border-border flex items-center gap-2">
      <span className="text-[12px] text-subtle w-28 shrink-0">Stripe Price ID</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        placeholder="price_... (leave blank to disable self-serve checkout)"
        className="flex-1 min-w-0 px-2 py-1 rounded-md border border-border bg-background text-[13px] outline-none focus:border-accent transition-colors placeholder:text-subtle"
      />
    </div>
  );
}

function PlanLimitsEditor({ planId }: { planId: string }) {
  const [rows, setRows] = useState<EditorRow[] | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getPlanEditorRows(planId).then((r) => {
      if (!cancelled) setRows(r as EditorRow[]);
    });
    return () => {
      cancelled = true;
    };
  }, [planId]);

  function handleChange(key: string, raw: string) {
    setRows((prev) => (prev ? prev.map((r) => (r.key === key ? { ...r, value: raw === "" ? null : Number(raw), hasRow: raw !== "" } : r)) : prev));
    const value = raw === "" ? null : Math.max(0, Math.round(Number(raw) || 0));
    startTransition(() => updatePlanLimit(planId, key as EntitlementKey, value));
  }

  function handleToggleFeature(key: string, enabled: boolean) {
    setRows((prev) => (prev ? prev.map((r) => (r.key === key ? { ...r, value: enabled ? null : 0, hasRow: !enabled } : r)) : prev));
    startTransition(() => updatePlanLimit(planId, key as EntitlementKey, enabled ? null : 0));
  }

  if (!rows) {
    return <p className="px-4 py-6 text-[13px] text-subtle">Loading…</p>;
  }

  const grouped = {
    count: rows.filter((r) => r.type === "count"),
    monthly: rows.filter((r) => r.type === "monthly"),
    feature: rows.filter((r) => r.type === "feature"),
  };

  return (
    <div className="divide-y divide-border">
      {(["feature", "count", "monthly"] as const).map((type) =>
        grouped[type].length === 0 ? null : (
          <div key={type} className="px-4 py-3">
            <p className="text-[11px] font-medium text-subtle uppercase tracking-wide mb-2">{TYPE_LABEL[type]}</p>
            <div className="space-y-1.5">
              {grouped[type].map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-3">
                  <span className="text-[13px] truncate">{row.label}</span>
                  {row.type === "feature" ? (
                    <button
                      onClick={() => handleToggleFeature(row.key, row.value === 0)}
                      className={`shrink-0 px-2.5 py-1 rounded-md text-[12px] border transition-colors ${
                        row.value === 0
                          ? "border-red-500/30 text-red-500 hover:bg-red-500/10"
                          : "border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                      }`}
                    >
                      {row.value === 0 ? "Disabled" : "Enabled"}
                    </button>
                  ) : (
                    <input
                      type="number"
                      min={0}
                      value={row.value ?? ""}
                      onChange={(e) => handleChange(row.key, e.target.value)}
                      placeholder="Unlimited"
                      className="w-28 shrink-0 px-2 py-1 rounded-md border border-border bg-background text-[13px] text-right outline-none focus:border-accent transition-colors placeholder:text-subtle"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
