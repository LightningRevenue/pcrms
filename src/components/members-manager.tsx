"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { inviteMember, revokeInvite, type InviteMemberInput } from "@/lib/actions/members";

type Member = { id: string; name: string | null; email: string | null; image: string | null; role: string };
type Invite = { id: string; email: string; role: string; createdAt: Date; expiresAt: Date };

export function MembersManager({ members, invites: initialInvites }: { members: Member[]; invites: Invite[] }) {
  const [invites, setInvites] = useState(initialInvites);
  const [inviting, setInviting] = useState(false);
  const [, startTransition] = useTransition();

  function handleRevoke(id: string) {
    startTransition(async () => {
      await revokeInvite(id);
      setInvites((prev) => prev.filter((i) => i.id !== id));
    });
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-medium text-subtle uppercase tracking-wide">Members</p>
        <button
          onClick={() => setInviting(true)}
          className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors"
        >
          <Plus size={14} strokeWidth={1.75} />
          Invite member
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
            <span className="text-[11px] text-subtle capitalize shrink-0">{m.role}</span>
          </div>
        ))}
        {members.length === 0 && <div className="px-3 py-4 text-[13px] text-subtle text-center">No members yet</div>}
      </div>

      {invites.length > 0 && (
        <>
          <p className="text-[12px] font-medium text-subtle uppercase tracking-wide mt-6">Pending invites</p>
          <div className="mt-2 border border-border rounded-md overflow-hidden">
            {invites.map((i) => (
              <div key={i.id} className="flex items-center gap-3 px-3 py-2.5 text-[13px] border-b border-border last:border-b-0">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{i.email}</div>
                  <div className="text-subtle text-[12px] capitalize">{i.role}</div>
                </div>
                <button
                  onClick={() => handleRevoke(i.id)}
                  className="text-[12px] text-subtle hover:text-foreground transition-colors shrink-0"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {inviting && <InviteMemberDialog onCancel={() => setInviting(false)} />}
    </div>
  );
}

function InviteMemberDialog({ onCancel }: { onCancel: () => void }) {
  const [form, setForm] = useState<InviteMemberInput>({ email: "", role: "member" });
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    const email = form.email.trim();
    if (!email) return setError("Email is required");

    startTransition(async () => {
      try {
        await inviteMember({ email, role: form.role });
        setSent(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not send invite");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-96 rounded-lg border border-border bg-background shadow-2xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-medium">Invite member</h2>
          <button onClick={onCancel} className="p-1 text-subtle hover:text-foreground transition-colors">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        {sent ? (
          <p className="text-[13px] text-subtle mt-4">Invite sent to {form.email}.</p>
        ) : (
          <div className="mt-4 space-y-3">
            <Field label="Email address">
              <input
                autoFocus
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="name@example.com"
                className="w-full text-[13px] outline-none bg-transparent border-b border-border focus:border-accent transition-colors py-1.5"
              />
            </Field>
            <Field label="Role">
              <select
                value={form.role}
                onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as "owner" | "member" }))}
                className="w-full text-[13px] outline-none bg-transparent border-b border-border focus:border-accent transition-colors py-1.5"
              >
                <option value="member">Member</option>
                <option value="owner">Owner</option>
              </select>
            </Field>
          </div>
        )}

        {error && <p className="text-[12px] text-red-400 mt-3">{error}</p>}

        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onCancel} className="px-3 py-1.5 rounded-md text-[13px] text-subtle hover:bg-muted transition-colors">
            {sent ? "Close" : "Cancel"}
          </button>
          {!sent && (
            <button
              onClick={submit}
              disabled={isPending}
              className="px-3 py-1.5 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Send invite
            </button>
          )}
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
