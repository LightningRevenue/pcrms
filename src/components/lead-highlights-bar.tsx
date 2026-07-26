"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Opportunity, PipelineStage } from "@prisma/client";
import {
  Mail,
  MoreHorizontal,
  Handshake,
  GitBranch,
  CheckSquare,
  StickyNote,
  Trash2,
  X,
  Building2,
  Phone,
  UserCircle,
  Check,
  BookOpen,
} from "lucide-react";
import { ConvertToOpportunityPanel, type NewOpportunityDraft } from "@/components/convert-to-opportunity-panel";
import { AddToSequencePanel } from "@/components/add-to-sequence-panel";
import { FavoriteButton } from "@/components/favorite-button";
import { EmailComposer, type ComposerDraft, type MailboxOption } from "@/components/email-composer";
import { CallButton } from "@/components/call-button";
import { CreateTaskPanel, type NewTaskDraft } from "@/components/create-task-panel";
import { CreateNotePanel } from "@/components/create-note-panel";
import { CompanyLogo } from "@/components/company-logo";
import { ContactPlaybooksPanel } from "@/components/contact-playbooks-panel";
import { CompanyAutocompleteField } from "@/components/company-autocomplete-field";
import { OwnerSelect } from "@/components/owner-select";
import { NameInput, HighlightField, ActionButton, dueLabel } from "@/components/highlights-primitives";
import { convertContactToOpportunity } from "@/lib/actions/opportunities";
import { deleteContacts, setPersonCompany, setPersonOwner, updatePersonField, type PersonField } from "@/lib/actions/contacts";
import { createTask, toggleTask } from "@/lib/actions/tasks";
import { createNote } from "@/lib/actions/notes";
import type { NextStep } from "@/lib/next-step";

type WorkspaceUser = { id: string; name: string | null; email: string | null };

// Salesforce-style highlights panel: identity + the facts you need before you speak to
// someone + what to do next, all on one row. Replaces the old breadcrumb-only LeadHeaderBar.
export function LeadHighlightsBar({
  contactId,
  firstName: firstName0,
  lastName: lastName0,
  index,
  total,
  companyId,
  companyName,
  companyDomain,
  jobTitle,
  ownerId,
  personEmail,
  personPhone,
  unsubscribed = false,
  stages,
  opportunities,
  isFavorited,
  mailboxes,
  users = [],
  nextStep,
}: {
  contactId: string;
  firstName: string;
  lastName: string | null;
  index: number;
  total: number;
  companyId: string | null;
  companyName: string | null;
  companyDomain: string | null;
  jobTitle: string | null;
  ownerId: string | null;
  personEmail: string | null;
  personPhone: string | null;
  unsubscribed?: boolean;
  stages: PipelineStage[];
  opportunities?: Opportunity[];
  isFavorited: boolean;
  mailboxes: MailboxOption[];
  users?: WorkspaceUser[];
  nextStep: NextStep;
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(firstName0);
  const [lastName, setLastName] = useState(lastName0 ?? "");
  const [editingCompany, setEditingCompany] = useState(false);
  const [showPlaybooks, setShowPlaybooks] = useState(false);
  const name = [firstName, lastName].filter(Boolean).join(" ");
  const [converting, setConverting] = useState(false);
  const [addingToSequence, setAddingToSequence] = useState(false);
  const [draft, setDraft] = useState<ComposerDraft | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const [creatingNote, setCreatingNote] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(field: Exclude<PersonField, "company">, value: string) {
    startTransition(() => updatePersonField(contactId, field, value));
  }

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
    <div className="relative shrink-0 border-b border-border">
      {error && (
        <div className="flex items-center justify-between gap-2 px-6 py-1.5 bg-red-500/10 border-b border-border">
          <p className="text-[12px] text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="text-subtle hover:text-foreground transition-colors">
            <X size={13} strokeWidth={1.75} />
          </button>
        </div>
      )}

      <div className="flex items-center gap-1.5 px-6 pt-2.5 text-[12px] text-subtle">
        <Link href="/contacts" className="hover:text-foreground transition-colors">
          People
        </Link>
        <span>/</span>
        <span className="text-foreground">{name}</span>
        <span className="ml-1">
          ({index}/{total})
        </span>
      </div>

      <div className="flex items-start justify-between gap-6 px-6 pt-1.5 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <CompanyLogo domain={companyDomain} fallbackText={firstName.slice(0, 1)} size={28} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <NameInput
                  value={firstName}
                  onChange={setFirstName}
                  onCommit={(v) => v.trim() && v !== firstName0 && save("firstName", v)}
                  placeholder="First name"
                />
                <NameInput
                  value={lastName}
                  onChange={setLastName}
                  onCommit={(v) => v !== lastName0 && save("lastName", v)}
                  placeholder="Last name"
                />
              </div>
              <p className="text-[12px] text-subtle truncate">
                {[jobTitle, companyName].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-x-6 gap-y-1 mt-2.5">
            {/* Compose-only: the address is edited in the left panel's General section. */}
            <HighlightField icon={Mail} label="Email">
              {personEmail ? (
                <button
                  onClick={openCompose}
                  title={`Email ${personEmail}`}
                  className="w-full text-left truncate hover:text-accent transition-colors"
                >
                  {personEmail}
                </button>
              ) : (
                <span className="text-subtle">—</span>
              )}
            </HighlightField>
            {/* Click-to-call through Twilio, same component the Call action uses so the
                device/state stays in one place. The number is edited in the left panel. */}
            <HighlightField icon={Phone} label="Phone">
              {personPhone ? (
                <CallButton
                  personId={contactId}
                  phone={personPhone}
                  name={name}
                  renderTrigger={({ onCall, disabled, title }) => (
                    <button
                      onClick={onCall}
                      disabled={disabled}
                      title={title}
                      className="w-full text-left truncate hover:text-accent transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {personPhone}
                    </button>
                  )}
                />
              ) : (
                <span className="text-subtle">—</span>
              )}
            </HighlightField>
            <HighlightField icon={Building2} label="Company">
              {editingCompany ? (
                <CompanyAutocompleteField
                  value={companyName ?? ""}
                  showLabel={false}
                  onSelect={async (c) => {
                    setEditingCompany(false);
                    await setPersonCompany(contactId, c);
                  }}
                />
              ) : (
                <button onClick={() => setEditingCompany(true)} className="w-full text-left truncate">
                  {companyName && companyId ? (
                    <Link
                      href={`/companies/${companyId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-accent transition-colors"
                    >
                      {companyName}
                    </Link>
                  ) : (
                    <span className="text-subtle">—</span>
                  )}
                </button>
              )}
            </HighlightField>
            <HighlightField icon={UserCircle} label="Owner">
              <OwnerSelect
                users={users}
                ownerId={ownerId}
                onChange={(id) => startTransition(() => setPersonOwner(contactId, id))}
              />
            </HighlightField>
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5">
            <ActionButton icon={Mail} label="Email" onClick={openCompose} disabled={!personEmail} title={personEmail ? undefined : "This contact has no email address"} />
            <CallButton personId={contactId} phone={personPhone} name={name} />
            <ActionButton icon={CheckSquare} label="Task" onClick={() => setCreatingTask(true)} />
            <ActionButton icon={StickyNote} label="Note" onClick={() => setCreatingNote(true)} />
            <ActionButton icon={Handshake} label="Convert" onClick={() => setConverting(true)} disabled={pending} />
            <ActionButton icon={GitBranch} label="Sequence" onClick={() => setAddingToSequence(true)} />
            <ActionButton icon={BookOpen} label="Playbooks" onClick={() => setShowPlaybooks(true)} />
            <FavoriteButton
              entityType="person"
              entityId={contactId}
              name={name}
              href={`/lead/${contactId}`}
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

          <NextStepChip step={nextStep} />
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

      {showPlaybooks && <ContactPlaybooksPanel onClose={() => setShowPlaybooks(false)} />}

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






function NextStepChip({ step }: { step: NextStep }) {
  const [done, setDone] = useState(false);
  const [, startTransition] = useTransition();

  if (step.kind === "idle") {
    const days = step.lastTouch
      ? Math.round((Date.now() - step.lastTouch.getTime()) / 86_400_000)
      : null;
    return (
      <p className="text-[12px] text-subtle">
        No next step ·{" "}
        {days === null ? "never contacted" : days === 0 ? "last touch today" : `last touch ${days}d ago`}
      </p>
    );
  }

  if (step.kind === "sequence") {
    return (
      <p className="text-[12px]">
        <span className="text-subtle">Next: </span>
        {step.label}
        <span className="text-subtle"> · {dueLabel(step.runAt)}</span>
      </p>
    );
  }

  const overdue = !!step.dueAt && step.dueAt.getTime() < Date.now();

  return (
    <div className="flex items-center gap-1.5 text-[12px]">
      <button
        onClick={() => {
          setDone(true);
          startTransition(() => toggleTask(step.id));
        }}
        disabled={done}
        title="Mark complete"
        className="flex items-center justify-center size-4 shrink-0 rounded-full border border-border hover:border-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
      >
        {done && <Check size={10} strokeWidth={3} className="text-accent" />}
      </button>
      <span className={done ? "line-through text-subtle" : ""}>
        <span className="text-subtle">Next: </span>
        {step.title}
        <span className={overdue && !done ? "text-red-400" : "text-subtle"}> · {dueLabel(step.dueAt)}</span>
      </span>
    </div>
  );
}

