"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Sequence, User } from "@prisma/client";
import { List, GitBranch, ChevronDown, Plus, Layers, Users, Trash2 } from "lucide-react";
import { createSequence, deleteSequence } from "@/lib/actions/sequences";

type SequenceRow = Sequence & { createdBy: User | null; _count: { steps: number; enrollments: number } };

function relativeTime(date: Date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function SequencesView({ sequences: initial }: { sequences: SequenceRow[] }) {
  const [sequences, setSequences] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleCreate() {
    if (!name.trim()) return;
    startTransition(async () => {
      const sequence = await createSequence(name);
      setCreating(false);
      setName("");
      router.push(`/sequences/${sequence.id}`);
    });
  }

  function handleDelete(e: React.MouseEvent, id: string, name: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${name}"? This removes its steps and enrollment history.`)) return;
    setSequences((prev) => prev.filter((s) => s.id !== id));
    startTransition(() => deleteSequence(id));
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="h-12 shrink-0 flex items-center justify-between px-6 border-b border-border">
        <div className="flex items-center gap-1.5 text-[13px]">
          <GitBranch size={14} strokeWidth={1.75} className="text-amber-400" />
          <span className="font-medium">Sequences</span>
        </div>
        {creating ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Sequence name"
              className="px-2.5 py-1 rounded-md border border-border text-[13px] outline-none bg-transparent placeholder:text-subtle focus:border-accent transition-colors"
            />
            <button
              onClick={handleCreate}
              disabled={pending}
              className="px-2.5 py-1 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Create
            </button>
            <button
              onClick={() => setCreating(false)}
              className="px-2.5 py-1 rounded-md text-[13px] text-subtle hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity"
          >
            <Plus size={14} strokeWidth={2} />
            New Sequence
          </button>
        )}
      </div>

      <div className="h-11 shrink-0 flex items-center justify-between px-6 border-b border-border">
        <button className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors">
          <List size={14} strokeWidth={1.75} />
          All Sequences
          <span className="text-subtle">· {sequences.length}</span>
          <ChevronDown size={13} strokeWidth={1.75} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {sequences.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <GitBranch size={24} strokeWidth={1.5} className="text-subtle" />
            <p className="text-[13px] text-subtle mt-3">No sequences yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sequences.map((s) => (
              <Link
                key={s.id}
                href={`/sequences/${s.id}`}
                className="flex items-center gap-6 px-6 py-3 hover:bg-muted/40 transition-colors group"
              >
                <span className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="text-[13px] truncate">{s.name}</span>
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                      s.active ? "bg-emerald-500 text-white" : "bg-muted text-subtle"
                    }`}
                  >
                    {s.active ? "Active" : "Paused"}
                  </span>
                </span>
                <span className="flex items-center gap-1.5 text-[12px] text-subtle shrink-0">
                  <Layers size={13} strokeWidth={1.75} />
                  {s._count.steps} steps
                </span>
                <span className="flex items-center gap-1.5 text-[12px] text-subtle shrink-0">
                  <Users size={13} strokeWidth={1.75} />
                  {s._count.enrollments} enrolled
                </span>
                <span className="text-[12px] text-subtle shrink-0 w-20 text-right">{relativeTime(s.createdAt)}</span>
                <button
                  onClick={(e) => handleDelete(e, s.id, s.name)}
                  title="Delete sequence"
                  className="p-1 rounded text-subtle opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity shrink-0"
                >
                  <Trash2 size={13} strokeWidth={1.75} />
                </button>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
