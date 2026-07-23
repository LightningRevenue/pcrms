"use client";

import { useState, useTransition } from "react";
import { Plus, X, Trash2, UserX, UserCheck } from "lucide-react";
import {
  createGdprRequest,
  updateGdprRequestStatus,
  deleteGdprRequest,
  searchContactsForGdpr,
  setPersonUnsubscribed,
  type GdprRequestInput,
} from "@/lib/actions/gdpr";

type Person = { id: string; firstName: string; lastName: string | null; email: string | null; unsubscribedAt?: Date | null };
type GdprRequest = {
  id: string;
  type: string;
  status: string;
  note: string | null;
  requestedAt: Date;
  subjectName: string | null;
  subjectEmail: string | null;
  person: Person | null;
};

const TYPE_LABEL: Record<string, string> = { access: "Access", erasure: "Erasure", export: "Export" };
const STATUS_LABEL: Record<string, string> = { open: "Open", in_progress: "In progress", completed: "Completed" };

function personLabel(p: Person) {
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email || "Unknown";
}

export function GdprManager({ requests: initial, unsubscribed: initialUnsubscribed }: { requests: GdprRequest[]; unsubscribed: Person[] }) {
  const [requests, setRequests] = useState(initial);
  const [unsubscribed, setUnsubscribed] = useState(initialUnsubscribed);
  const [adding, setAdding] = useState(false);
  const [, startTransition] = useTransition();

  function handleCreate(input: GdprRequestInput) {
    startTransition(() => {
      void createGdprRequest(input).then((request) => {
        setRequests((prev) => [{ ...request, person: null }, ...prev]);
        setAdding(false);
      });
    });
  }

  function handleStatus(id: string, status: "open" | "in_progress" | "completed") {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    startTransition(() => void updateGdprRequestStatus(id, status));
  }

  function handleDelete(id: string) {
    setRequests((prev) => prev.filter((r) => r.id !== id));
    startTransition(() => deleteGdprRequest(id));
  }

  function handleResubscribe(personId: string) {
    setUnsubscribed((prev) => prev.filter((p) => p.id !== personId));
    startTransition(() => setPersonUnsubscribed(personId, false));
  }

  return (
    <div className="mt-6 space-y-8">
      <div>
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-medium text-subtle uppercase tracking-wide">Data-subject requests</p>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors"
          >
            <Plus size={14} strokeWidth={1.75} />
            Add request
          </button>
        </div>

        <div className="mt-2 border border-border rounded-md overflow-hidden">
          {requests.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 text-[13px] border-b border-border last:border-b-0 group">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  {TYPE_LABEL[r.type] ?? r.type} — {r.person ? personLabel(r.person) : r.subjectName || r.subjectEmail}
                </div>
                {r.note && <div className="text-subtle text-[12px] truncate">{r.note}</div>}
              </div>
              <select
                value={r.status}
                onChange={(e) => handleStatus(r.id, e.target.value as "open" | "in_progress" | "completed")}
                className="shrink-0 text-[12px] bg-muted rounded-full px-2 py-0.5 outline-none border-none"
              >
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => handleDelete(r.id)}
                className="p-1 rounded text-subtle opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity shrink-0"
                title="Delete request"
              >
                <Trash2 size={13} strokeWidth={1.75} />
              </button>
            </div>
          ))}
          {requests.length === 0 && !adding && (
            <div className="px-3 py-4 text-[13px] text-subtle text-center">No requests tracked yet</div>
          )}
        </div>
      </div>

      <div>
        <p className="text-[12px] font-medium text-subtle uppercase tracking-wide">Unsubscribed contacts</p>
        <div className="mt-2 border border-border rounded-md overflow-hidden">
          {unsubscribed.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 text-[13px] border-b border-border last:border-b-0 group">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{personLabel(p)}</div>
                <div className="text-subtle text-[12px] truncate">{p.email}</div>
              </div>
              <button
                onClick={() => {
                  if (!confirm(`Resubscribe ${personLabel(p)}? They'll be able to receive emails again.`)) return;
                  handleResubscribe(p.id);
                }}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-subtle hover:text-foreground hover:bg-muted transition-colors shrink-0 text-[12px]"
                title="Resubscribe"
              >
                <UserCheck size={13} strokeWidth={1.75} />
                Resubscribe
              </button>
            </div>
          ))}
          {unsubscribed.length === 0 && (
            <div className="px-3 py-4 text-[13px] text-subtle text-center">No unsubscribed contacts</div>
          )}
        </div>
      </div>

      {adding && <AddRequestDialog onCancel={() => setAdding(false)} onCreate={handleCreate} />}
    </div>
  );
}

function AddRequestDialog({ onCancel, onCreate }: { onCancel: () => void; onCreate: (input: GdprRequestInput) => void }) {
  const [type, setType] = useState<GdprRequestInput["type"]>("access");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [selected, setSelected] = useState<Person | null>(null);
  const [subjectEmail, setSubjectEmail] = useState("");
  const [note, setNote] = useState("");
  const [markUnsubscribed, setMarkUnsubscribed] = useState(true);
  const [, startTransition] = useTransition();

  function handleQuery(q: string) {
    setQuery(q);
    setSelected(null);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    startTransition(async () => setResults(await searchContactsForGdpr(q)));
  }

  function submit() {
    if (!selected && !subjectEmail.trim()) return;
    onCreate({
      type,
      personId: selected?.id,
      subjectName: selected ? personLabel(selected) : undefined,
      subjectEmail: selected?.email || subjectEmail.trim() || undefined,
      note: note.trim() || undefined,
    });
    if (type === "erasure" && markUnsubscribed && selected) {
      setPersonUnsubscribed(selected.id, true);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[26rem] rounded-lg border border-border bg-background shadow-2xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-medium">Add GDPR request</h2>
          <button onClick={onCancel} className="p-1 text-subtle hover:text-foreground transition-colors">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-[12px] text-subtle">Request type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as GdprRequestInput["type"])}
              className="w-full mt-0.5 text-[13px] outline-none bg-transparent border-b border-border focus:border-accent transition-colors py-1.5"
            >
              <option value="access">Access</option>
              <option value="erasure">Erasure</option>
              <option value="export">Export</option>
            </select>
          </label>

          <label className="block">
            <span className="text-[12px] text-subtle">Contact</span>
            <input
              autoFocus
              value={selected ? personLabel(selected) : query}
              onChange={(e) => handleQuery(e.target.value)}
              placeholder="Search contacts by name or email"
              className="w-full mt-0.5 text-[13px] outline-none bg-transparent border-b border-border focus:border-accent transition-colors py-1.5"
            />
            {results.length > 0 && !selected && (
              <div className="mt-1 border border-border rounded-md overflow-hidden max-h-40 overflow-y-auto">
                {results.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelected(p);
                      setResults([]);
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-[13px] hover:bg-muted transition-colors"
                  >
                    {personLabel(p)} <span className="text-subtle text-[12px]">{p.email}</span>
                  </button>
                ))}
              </div>
            )}
          </label>

          {!selected && (
            <label className="block">
              <span className="text-[12px] text-subtle">Or enter email directly</span>
              <input
                value={subjectEmail}
                onChange={(e) => setSubjectEmail(e.target.value)}
                placeholder="person@example.com"
                className="w-full mt-0.5 text-[13px] outline-none bg-transparent border-b border-border focus:border-accent transition-colors py-1.5"
              />
            </label>
          )}

          <label className="block">
            <span className="text-[12px] text-subtle">Note (optional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full mt-0.5 text-[13px] outline-none bg-transparent border-b border-border focus:border-accent transition-colors py-1.5 resize-none"
            />
          </label>

          {type === "erasure" && selected && (
            <label className="flex items-center gap-2 text-[12px] text-subtle">
              <input type="checkbox" checked={markUnsubscribed} onChange={(e) => setMarkUnsubscribed(e.target.checked)} />
              <UserX size={13} strokeWidth={1.75} />
              Also unsubscribe this contact from all future emails
            </label>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onCancel} className="px-3 py-1.5 rounded-md text-[13px] text-subtle hover:bg-muted transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            className="px-3 py-1.5 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity"
          >
            Add request
          </button>
        </div>
      </div>
    </div>
  );
}
