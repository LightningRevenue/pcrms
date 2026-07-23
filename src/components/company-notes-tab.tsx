"use client";

import Link from "next/link";
import type { Note, NoteOpportunity, Opportunity, Person, User } from "@prisma/client";
import { StickyNote, User as UserIcon } from "lucide-react";
import { AssociatedDeals } from "@/components/associated-deals";
import { useContactHref } from "@/lib/view-mode";

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

type CompanyNote = Note & {
  person: Person;
  createdBy: User | null;
  opportunities: (NoteOpportunity & { opportunity: Opportunity })[];
};

export function CompanyNotesTab({ notes }: { notes: CompanyNote[] }) {
  const contactHref = useContactHref();
  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-subtle">
        <StickyNote size={24} strokeWidth={1.5} />
        <p className="text-[13px] mt-2">No notes on this company&apos;s contacts yet.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[12px] font-medium text-subtle uppercase tracking-wide mb-3">
        Notes across contacts &amp; deals
      </p>
      <div className="border border-border rounded-lg divide-y divide-border">
        {notes.map((note) => {
          const deals = note.opportunities.map((o) => o.opportunity);
          const personName = [note.person.firstName, note.person.lastName].filter(Boolean).join(" ");
          return (
            <div key={note.id} className="px-4 py-3">
              <p className="text-[13px] whitespace-pre-wrap">{note.body}</p>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-[12px] text-subtle">
                  {note.createdBy?.name ?? note.createdBy?.email ?? "Someone"} · {relativeTime(note.createdAt)}
                </span>
                <Link
                  href={contactHref(note.person.id)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted text-[11px] text-subtle hover:text-foreground hover:bg-muted/70 transition-colors"
                  title={`Go to ${personName}`}
                >
                  <UserIcon size={11} strokeWidth={1.75} />
                  {personName}
                </Link>
                {deals.length > 0 && <AssociatedDeals opportunities={deals} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
