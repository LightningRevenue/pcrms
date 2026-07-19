"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { createMember, type CreateMemberInput } from "@/lib/actions/members";

type Member = { id: string; name: string | null; email: string | null; image: string | null };

const EMPTY_FORM: CreateMemberInput = { firstName: "", lastName: "", email: "" };

export function MembersManager({ members: initial }: { members: Member[] }) {
  const [members, setMembers] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [, startTransition] = useTransition();

  function handleCreate(input: CreateMemberInput) {
    startTransition(async () => {
      const member = await createMember(input);
      setMembers((prev) => [...prev, member]);
    });
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-medium text-subtle uppercase tracking-wide">Members</p>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors"
        >
          <Plus size={14} strokeWidth={1.75} />
          Add member
        </button>
      </div>

      <div className="mt-2 border border-border rounded-md overflow-hidden">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 text-[13px] border-b border-border last:border-b-0">
            <div className="size-7 shrink-0 rounded-full bg-accent flex items-center justify-center text-[11px] font-semibold text-white">
              {(m.name ?? m.email ?? "?")[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{m.name || "Unnamed"}</div>
              <div className="text-subtle text-[12px] truncate">{m.email}</div>
            </div>
          </div>
        ))}
        {members.length === 0 && !adding && (
          <div className="px-3 py-4 text-[13px] text-subtle text-center">No members yet</div>
        )}
      </div>

      {adding && <AddMemberDialog onCancel={() => setAdding(false)} onCreate={handleCreate} />}
    </div>
  );
}

function AddMemberDialog({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (input: CreateMemberInput) => void;
}) {
  const [form, setForm] = useState<CreateMemberInput>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof CreateMemberInput>(key: K, value: CreateMemberInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit() {
    setError(null);
    if (!form.firstName.trim()) return setError("First name is required");
    if (!form.email.trim()) return setError("Email is required");
    onCreate(form);
    onCancel();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-96 rounded-lg border border-border bg-background shadow-2xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-medium">Add member</h2>
          <button onClick={onCancel} className="p-1 text-subtle hover:text-foreground transition-colors">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <Field label="First name">
            <input
              autoFocus
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              className="w-full text-[13px] outline-none bg-transparent border-b border-border focus:border-accent transition-colors py-1.5"
            />
          </Field>
          <Field label="Last name">
            <input
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              className="w-full text-[13px] outline-none bg-transparent border-b border-border focus:border-accent transition-colors py-1.5"
            />
          </Field>
          <Field label="Email address">
            <input
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="name@example.com"
              className="w-full text-[13px] outline-none bg-transparent border-b border-border focus:border-accent transition-colors py-1.5"
            />
          </Field>
        </div>

        {error && <p className="text-[12px] text-red-400 mt-3">{error}</p>}

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md text-[13px] text-subtle hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="px-3 py-1.5 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity"
          >
            Add member
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12px] text-subtle">{label}</span>
      <div className="mt-0.5">{children}</div>
    </label>
  );
}
