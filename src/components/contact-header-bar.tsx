"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Opportunity, PipelineStage } from "@prisma/client";
import { Mail, MoreHorizontal, Handshake, GitBranch, CheckSquare, StickyNote, Trash2, X } from "lucide-react";
import { ConvertToOpportunityPanel, type NewOpportunityDraft } from "@/components/convert-to-opportunity-panel";
import { AddToSequencePanel } from "@/components/add-to-sequence-panel";
import { FavoriteButton } from "@/components/favorite-button";
import { EmailComposer, type ComposerDraft, type MailboxOption } from "@/components/email-composer";
import { CallButton } from "@/components/call-button";
import { CreateTaskPanel, type NewTaskDraft } from "@/components/create-task-panel";
import { CreateNotePanel } from "@/components/create-note-panel";
import { convertContactToOpportunity } from "@/lib/actions/opportunities";
import { deleteContacts } from "@/lib/actions/contacts";
import { createTask } from "@/lib/actions/tasks";
import { createNote } from "@/lib/actions/notes";

export function ContactHeaderBar({
  contactId,
  name,
  index,
  total,
  companyName,
  personEmail,
  personPhone,
  stages,
  opportunities,
  isFavorited,
  mailboxes,
}: {
  contactId: string;
  name: string;
  index: number;
  total: number;
  companyName: string | null;
  personEmail: string | null;
  personPhone: string | null;
  stages: PipelineStage[];
  opportunities?: Opportunity[];
  isFavorited: boolean;
  mailboxes: MailboxOption[];
}) {
  const router = useRouter();
  const [converting, setConverting] = useState(false);
  const [addingToSequence, setAddingToSequence] = useState(false);
  const [draft, setDraft] = useState<ComposerDraft | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const [creatingNote, setCreatingNote] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCreate(draft: NewOpportunityDraft) {
    setError(null);
    startTransition(async () => {
      try {
        await convertContactToOpportunity({
          personId: contactId,
          name: draft.name,
          stage: draft.stage,
          value: draft.value,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function openCompose() {
    setDraft({ personId: contactId, to: personEmail ? [personEmail] : [], contactFirstName: name.split(" ")[0] });
  }

  function handleCreateTask(task: NewTaskDraft) {
    setError(null);
    startTransition(async () => {
      try {
        await createTask({
          personId: contactId,
          title: task.title,
          description: task.description,
          type: task.type,
          due: task.due,
          priority: task.priority,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function handleCreateNote(body: string, opportunityIds: string[]) {
    setError(null);
    startTransition(async () => {
      try {
        await createNote(contactId, body, opportunityIds);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function handleDelete() {
    setMenuOpen(false);
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    startDelete(async () => {
      const { deleted } = await deleteContacts([contactId]);
      if (deleted === 0) {
        alert("Can't delete this contact — it has an associated opportunity. Remove that first.");
        return;
      }
      router.push("/contacts");
    });
  }

  return (
    <div className="relative shrink-0">
      {error && (
        <div className="flex items-center justify-between gap-2 px-6 py-1.5 bg-red-500/10 border-b border-border">
          <p className="text-[12px] text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="text-subtle hover:text-foreground transition-colors">
            <X size={13} strokeWidth={1.75} />
          </button>
        </div>
      )}
      <div className="h-14 flex items-center justify-between px-6 border-b border-border">
      <div className="flex items-center gap-1.5 text-[13px] text-subtle">
        <Link href="/contacts" className="hover:text-foreground transition-colors">
          People
        </Link>
        <span>/</span>
        <span className="text-foreground">{name}</span>
        <span className="ml-1">
          ({index}/{total})
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={openCompose}
          disabled={!personEmail}
          title={personEmail ? undefined : "This contact has no email address"}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[13px] hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Mail size={14} strokeWidth={1.75} />
          Send Email
        </button>
        <CallButton personId={contactId} phone={personPhone} name={name} />
        <button
          onClick={() => setCreatingTask(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[13px] hover:bg-muted transition-colors"
        >
          <CheckSquare size={14} strokeWidth={1.75} />
          Create Task
        </button>
        <button
          onClick={() => setCreatingNote(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[13px] hover:bg-muted transition-colors"
        >
          <StickyNote size={14} strokeWidth={1.75} />
          Create Note
        </button>
        <button
          onClick={() => setConverting(true)}
          disabled={pending}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[13px] hover:bg-muted transition-colors disabled:opacity-50"
        >
          <Handshake size={14} strokeWidth={1.75} />
          Convert to Opportunity
        </button>
        <button
          onClick={() => setAddingToSequence(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[13px] hover:bg-muted transition-colors"
        >
          <GitBranch size={14} strokeWidth={1.75} />
          Add to Sequence
        </button>
        <FavoriteButton
          entityType="person"
          entityId={contactId}
          name={name}
          href={`/contacts/${contactId}`}
          initialFavorited={isFavorited}
        />
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="p-1.5 rounded-md border border-border hover:bg-muted transition-colors"
          >
            <MoreHorizontal size={14} strokeWidth={1.75} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-40 border border-border rounded-md bg-surface shadow-lg z-20 py-1">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-red-400 hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <Trash2 size={13} strokeWidth={1.75} />
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      </div>

      {converting && (
        <ConvertToOpportunityPanel
          contactName={name}
          companyName={companyName}
          stages={stages}
          onClose={() => setConverting(false)}
          onCreate={handleCreate}
        />
      )}

      {addingToSequence && (
        <AddToSequencePanel personId={contactId} onClose={() => setAddingToSequence(false)} />
      )}

      {draft && <EmailComposer draft={draft} mailboxes={mailboxes} onClose={() => setDraft(null)} />}

      {creatingTask && (
        <CreateTaskPanel
          relatedTo={name}
          onClose={() => setCreatingTask(false)}
          onCreate={handleCreateTask}
        />
      )}

      {creatingNote && (
        <CreateNotePanel
          relatedTo={name}
          opportunities={opportunities}
          onClose={() => setCreatingNote(false)}
          onSave={handleCreateNote}
        />
      )}
    </div>
  );
}
