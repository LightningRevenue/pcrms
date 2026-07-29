"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mail,
  MoreHorizontal,
  CheckSquare,
  StickyNote,
  Trash2,
  X,
  Building2,
  DollarSign,
  UserCircle,
  Percent,
  CalendarDays,
} from "lucide-react";
import type { Company, Person } from "@prisma/client";
import { EmailComposer, type ComposerDraft, type MailboxOption } from "@/components/email-composer";
import { CallButton } from "@/components/call-button";
import { CreateTaskPanel, type NewTaskDraft } from "@/components/create-task-panel";
import { CreateNotePanel } from "@/components/create-note-panel";
import { FavoriteButton } from "@/components/favorite-button";
import { OwnerSelect } from "@/components/owner-select";
import { NameInput, HighlightField, ActionButton, NextStepChip } from "@/components/highlights-primitives";
import { createTask } from "@/lib/actions/tasks";
import { createNote } from "@/lib/actions/notes";
import {
  deleteOpportunity,
  setOpportunityOwner,
  setOpportunityValue,
  updateOpportunityField,
} from "@/lib/actions/opportunities";
import { formatMoney } from "@/lib/currency";
import type { NextStep } from "@/lib/next-step";

type WorkspaceUser = { id: string; name: string | null; email: string | null };

// Deal-side twin of LeadHighlightsBar: identity + the numbers you quote in a pipeline review +
// what happens next, on one row. Replaces the old breadcrumb-only OpportunityHeaderBar.
export function OpportunityHighlightsBar({
  opportunityId,
  name: name0,
  index,
  total,
  stage,
  value,
  currency,
  probability,
  stageProbability,
  expectedCloseDate,
  ownerId,
  company,
  contact,
  isFavorited,
  mailboxes,
  users = [],
  nextStep,
}: {
  opportunityId: string;
  name: string;
  index: number;
  total: number;
  stage: string;
  value: number;
  currency: string;
  probability: number | null;
  stageProbability: number | null;
  expectedCloseDate: Date | null;
  ownerId: string | null;
  company: Company | null;
  contact: Person | null;
  isFavorited: boolean;
  mailboxes: MailboxOption[];
  users?: WorkspaceUser[];
  nextStep: NextStep;
}) {
  const router = useRouter();
  const [name, setName] = useState(name0);
  const [editingValue, setEditingValue] = useState(false);
  const [draft, setDraft] = useState<ComposerDraft | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const [creatingNote, setCreatingNote] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const contactName = contact ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") : "";
  // Falls back to the stage's probability, same precedence getForecast() uses.
  const effectiveProbability = probability ?? stageProbability;

  function openCompose() {
    if (!contact) return;
    setDraft({
      personId: contact.id,
      to: contact.email ? [contact.email] : [],
      opportunityIds: [opportunityId],
      contactFirstName: contact.firstName,
      unsubscribed: !!contact.unsubscribedAt,
    });
  }

  function handleCreateTask(task: NewTaskDraft) {
    if (!contact) return;
    setError(null);
    startTransition(async () => {
      try {
        await createTask({
          personId: contact.id,
          title: task.title,
          description: task.description,
          type: task.type,
          due: task.due,
          priority: task.priority,
          opportunityIds: [opportunityId],
        });
        setCreatingTask(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function handleCreateNote(body: string) {
    if (!contact) return;
    setError(null);
    startTransition(async () => {
      try {
        await createNote(contact.id, body, [opportunityId]);
        setCreatingNote(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function handleDelete() {
    setMenuOpen(false);
    if (!confirm(`Delete ${name || "this deal"}? This cannot be undone.`)) return;
    startDelete(async () => {
      await deleteOpportunity(opportunityId);
      router.push("/deals");
    });
  }

  return (
    <div className="shrink-0 border-b border-border">
      {error && (
        <div className="flex items-center justify-between gap-2 px-6 py-1.5 bg-red-500/10 border-b border-border">
          <p className="text-[12px] text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="text-subtle hover:text-foreground transition-colors">
            <X size={13} strokeWidth={1.75} />
          </button>
        </div>
      )}

      <div className="flex items-center gap-1.5 px-6 pt-2.5 text-[12px] text-subtle">
        <Link href="/deals" className="hover:text-foreground transition-colors">
          Deals
        </Link>
        <span>/</span>
        <span className="text-foreground">{name || "Untitled"}</span>
        <span className="ml-1">
          ({index}/{total} in By Stage → {stage})
        </span>
      </div>

      <div className="flex items-start justify-between gap-6 px-6 pt-1.5 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="size-7 shrink-0 rounded-md bg-muted border border-border flex items-center justify-center text-[12px] font-medium text-subtle">
              {(name || "-")[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <NameInput
                value={name}
                onChange={setName}
                onCommit={(v) =>
                  v.trim() && v !== name0 && startTransition(() => updateOpportunityField(opportunityId, "name", v))
                }
                placeholder="Deal name"
              />
              <p className="text-[12px] text-subtle truncate">
                {[company?.name, contactName].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-x-6 gap-y-1 mt-2.5">
            <HighlightField icon={DollarSign} label="Amount">
              {editingValue ? (
                <input
                  autoFocus
                  type="number"
                  min={0}
                  defaultValue={value}
                  onBlur={(e) => {
                    setEditingValue(false);
                    const next = Number(e.target.value);
                    if (next !== value) startTransition(() => setOpportunityValue(opportunityId, next));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") setEditingValue(false);
                  }}
                  className="w-full bg-transparent text-[13px] outline-none border-b border-border"
                />
              ) : (
                <button onClick={() => setEditingValue(true)} className="w-full text-left truncate">
                  {formatMoney(value, currency)}
                </button>
              )}
            </HighlightField>
            <HighlightField icon={Percent} label="Probability">
              {effectiveProbability === null ? (
                <span className="text-subtle">—</span>
              ) : (
                <span title={probability === null ? `From stage "${stage}"` : "Set on this deal"}>
                  {effectiveProbability}%{probability === null && <span className="text-subtle"> (stage)</span>}
                </span>
              )}
            </HighlightField>
            <HighlightField icon={CalendarDays} label="Expected close">
              {expectedCloseDate ? (
                expectedCloseDate.toLocaleDateString()
              ) : (
                <span className="text-subtle">—</span>
              )}
            </HighlightField>
            <HighlightField icon={Building2} label="Company">
              {company ? (
                <Link href={`/companies/${company.id}`} className="hover:text-accent transition-colors truncate block">
                  {company.name}
                </Link>
              ) : (
                <span className="text-subtle">—</span>
              )}
            </HighlightField>
            <HighlightField icon={UserCircle} label="Owner">
              <OwnerSelect
                users={users}
                ownerId={ownerId}
                onChange={(id) => startTransition(() => setOpportunityOwner(opportunityId, id))}
              />
            </HighlightField>
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5">
            <ActionButton
              icon={Mail}
              label="Email"
              onClick={openCompose}
              disabled={!contact?.email}
              title={contact ? (contact.email ? undefined : "This contact has no email address") : "No point of contact on this deal"}
            />
            <CallButton personId={contact?.id ?? ""} phone={contact?.phone ?? null} name={contactName} />
            <ActionButton
              icon={CheckSquare}
              label="Task"
              onClick={() => setCreatingTask(true)}
              disabled={!contact}
              title={contact ? undefined : "No point of contact on this deal"}
            />
            <ActionButton
              icon={StickyNote}
              label="Note"
              onClick={() => setCreatingNote(true)}
              disabled={!contact}
              title={contact ? undefined : "No point of contact on this deal"}
            />
            <FavoriteButton
              entityType="opportunity"
              entityId={opportunityId}
              name={name || "Untitled"}
              href={`/deals/${opportunityId}`}
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

      {draft && <EmailComposer draft={draft} mailboxes={mailboxes} onClose={() => setDraft(null)} />}
      {creatingTask && contact && (
        <CreateTaskPanel relatedTo={contactName} onClose={() => setCreatingTask(false)} onCreate={handleCreateTask} />
      )}
      {creatingNote && contact && (
        <CreateNotePanel
          relatedTo={name || "this deal"}
          onClose={() => setCreatingNote(false)}
          onSave={handleCreateNote}
        />
      )}
    </div>
  );
}
