"use client";

import { useState, useTransition } from "react";
import type { Opportunity, PipelineStage } from "@prisma/client";
import { Mail, Handshake, GitBranch, CheckSquare, StickyNote, X } from "lucide-react";
import { ConvertToOpportunityPanel, type NewOpportunityDraft } from "@/components/convert-to-opportunity-panel";
import { AddToSequencePanel } from "@/components/add-to-sequence-panel";
import { EmailComposer, type ComposerDraft, type MailboxOption } from "@/components/email-composer";
import { CallButton } from "@/components/call-button";
import { CreateTaskPanel, type NewTaskDraft } from "@/components/create-task-panel";
import { CreateNotePanel } from "@/components/create-note-panel";
import { convertContactToOpportunity } from "@/lib/actions/opportunities";
import { createTask } from "@/lib/actions/tasks";
import { createNote } from "@/lib/actions/notes";

type WorkspaceUser = { id: string; name: string | null; email: string | null };

// Quick-action row for /lead/[id]'s left column — same actions ContactHeaderBar puts in the
// top bar on /contacts/[id], just relocated to sit under the contact's name instead.
export function LeadQuickActions({
  contactId,
  name,
  companyName,
  personEmail,
  personPhone,
  unsubscribed = false,
  stages,
  opportunities,
  mailboxes,
  users = [],
}: {
  contactId: string;
  name: string;
  companyName: string | null;
  personEmail: string | null;
  personPhone: string | null;
  unsubscribed?: boolean;
  stages: PipelineStage[];
  opportunities?: Opportunity[];
  mailboxes: MailboxOption[];
  users?: WorkspaceUser[];
}) {
  const [converting, setConverting] = useState(false);
  const [addingToSequence, setAddingToSequence] = useState(false);
  const [draft, setDraft] = useState<ComposerDraft | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const [creatingNote, setCreatingNote] = useState(false);
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
    setDraft({ personId: contactId, to: personEmail ? [personEmail] : [], contactFirstName: name.split(" ")[0], unsubscribed });
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

  return (
    <div>
      {error && (
        <div className="flex items-center justify-between gap-2 mb-2 px-2 py-1.5 rounded-md bg-red-500/10 border border-red-500/20">
          <p className="text-[12px] text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="text-subtle hover:text-foreground transition-colors">
            <X size={13} strokeWidth={1.75} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-6 gap-1.5">
        <button
          onClick={openCompose}
          disabled={!personEmail}
          title={personEmail ? "Email" : "This contact has no email address"}
          className="flex items-center justify-center size-9 rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Mail size={14} strokeWidth={1.75} />
        </button>
        <CallButton personId={contactId} phone={personPhone} name={name} compact />
        <button
          onClick={() => setCreatingTask(true)}
          title="Create task"
          className="flex items-center justify-center size-9 rounded-md border border-border hover:bg-muted transition-colors"
        >
          <CheckSquare size={14} strokeWidth={1.75} />
        </button>
        <button
          onClick={() => setCreatingNote(true)}
          title="Create note"
          className="flex items-center justify-center size-9 rounded-md border border-border hover:bg-muted transition-colors"
        >
          <StickyNote size={14} strokeWidth={1.75} />
        </button>
        <button
          onClick={() => setConverting(true)}
          disabled={pending}
          title="Convert to opportunity"
          className="flex items-center justify-center size-9 rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50"
        >
          <Handshake size={14} strokeWidth={1.75} />
        </button>
        <button
          onClick={() => setAddingToSequence(true)}
          title="Add to sequence"
          className="flex items-center justify-center size-9 rounded-md border border-border hover:bg-muted transition-colors"
        >
          <GitBranch size={14} strokeWidth={1.75} />
        </button>
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
          users={users}
          onClose={() => setCreatingNote(false)}
          onSave={handleCreateNote}
        />
      )}
    </div>
  );
}
