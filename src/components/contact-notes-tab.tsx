"use client";

import { useState, useTransition } from "react";
import type { Note, NoteOpportunity, Opportunity, User } from "@prisma/client";
import { Plus, StickyNote } from "lucide-react";
import { CreateNotePanel } from "@/components/create-note-panel";
import { AssociatedDeals } from "@/components/associated-deals";
import { createNote } from "@/lib/actions/notes";

export type NoteWithDeals = Note & { createdBy: User | null; opportunities: (NoteOpportunity & { opportunity: Opportunity })[] };

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

function NoteRow({ note }: { note: NoteWithDeals }) {
  const deals = note.opportunities.map((o) => o.opportunity);
  return (
    <div className="px-4 py-3">
      <p className="text-[13px] whitespace-pre-wrap">{note.body}</p>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[12px] text-subtle">
          {note.createdBy?.name ?? note.createdBy?.email ?? "Someone"} · {relativeTime(note.createdAt)}
        </span>
        {deals.length > 0 && <AssociatedDeals opportunities={deals} />}
      </div>
    </div>
  );
}

export function ContactNotesTab({
  personId,
  contactName,
  notes,
  opportunities = [],
}: {
  personId: string;
  contactName: string;
  notes: NoteWithDeals[];
  opportunities?: Opportunity[];
}) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function addNote(body: string, opportunityIds: string[]) {
    setError(null);
    startTransition(async () => {
      try {
        await createNote(personId, body, opportunityIds);
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
          disabled={pending}
          className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors disabled:opacity-50"
        >
          <Plus size={14} strokeWidth={1.75} />
          New note
        </button>
      </div>

      {error && <p className="text-[12px] text-red-400 mb-2">{error}</p>}

      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-subtle">
          <StickyNote size={24} strokeWidth={1.5} />
          <p className="text-[13px] mt-2">No notes yet.</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border">
          {notes.map((n) => (
            <NoteRow key={n.id} note={n} />
          ))}
        </div>
      )}

      {creating && (
        <CreateNotePanel
          relatedTo={contactName}
          opportunities={opportunities}
          onClose={() => setCreating(false)}
          onSave={addNote}
        />
      )}
    </div>
  );
}
