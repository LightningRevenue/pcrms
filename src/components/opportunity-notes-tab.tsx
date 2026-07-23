"use client";

import { useState, useTransition } from "react";
import { Plus, StickyNote } from "lucide-react";
import { CreateNotePanel } from "@/components/create-note-panel";
import { renderNoteBody, type NoteWithDeals } from "@/components/contact-notes-tab";
import { createNote } from "@/lib/actions/notes";

type WorkspaceUser = { id: string; name: string | null; email: string | null };

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

function NoteRow({ note, users }: { note: NoteWithDeals; users: WorkspaceUser[] }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[13px] whitespace-pre-wrap">{renderNoteBody(note.body, users)}</p>
      <span className="text-[12px] text-subtle mt-2 block">
        {note.createdBy?.name ?? note.createdBy?.email ?? "Someone"} · {relativeTime(note.createdAt)}
      </span>
    </div>
  );
}

export function OpportunityNotesTab({
  personId,
  contactName,
  opportunityId,
  notes,
  users = [],
}: {
  personId: string | null;
  contactName: string;
  opportunityId: string;
  notes: NoteWithDeals[];
  users?: WorkspaceUser[];
}) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function addNote(body: string) {
    if (!personId) return;
    setError(null);
    startTransition(async () => {
      try {
        await createNote(personId, body, [opportunityId]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12px] font-medium text-subtle uppercase tracking-wide">Notes</p>
        <button
          onClick={() => setCreating(true)}
          disabled={pending || !personId}
          title={personId ? undefined : "No point of contact on this deal"}
          className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={14} strokeWidth={1.75} />
          New note
        </button>
      </div>

      {error && <p className="text-[12px] text-red-400 mb-3">{error}</p>}

      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-subtle">
          <StickyNote size={24} strokeWidth={1.5} />
          <p className="text-[13px] mt-2">No notes linked to this deal yet.</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border">
          {notes.map((n) => (
            <NoteRow key={n.id} note={n} users={users} />
          ))}
        </div>
      )}

      {creating && personId && (
        <CreateNotePanel relatedTo={contactName} users={users} onClose={() => setCreating(false)} onSave={(body) => addNote(body)} />
      )}
    </div>
  );
}
