"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, MoreHorizontal, CheckSquare, Trash2 } from "lucide-react";
import type { Person } from "@prisma/client";
import { EmailComposer, type ComposerDraft, type MailboxOption } from "@/components/email-composer";
import { CreateTaskPanel, type NewTaskDraft } from "@/components/create-task-panel";
import { FavoriteButton } from "@/components/favorite-button";
import { createTask } from "@/lib/actions/tasks";
import { deleteOpportunity } from "@/lib/actions/opportunities";

export function OpportunityHeaderBar({
  opportunityId,
  name,
  index,
  total,
  stage,
  contact,
  isFavorited,
  mailboxes,
}: {
  opportunityId: string;
  name: string;
  index: number;
  total: number;
  stage: string;
  contact: Person | null;
  isFavorited: boolean;
  mailboxes: MailboxOption[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ComposerDraft | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [, startCreateTask] = useTransition();

  function openCompose() {
    if (!contact) return;
    setDraft({
      personId: contact.id,
      to: contact.email ? [contact.email] : [],
      opportunityIds: [opportunityId],
      contactFirstName: contact.firstName,
    });
  }

  function handleCreateTask(task: NewTaskDraft) {
    if (!contact) return;
    setTaskError(null);
    startCreateTask(async () => {
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
        setTaskError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function handleDelete() {
    setMenuOpen(false);
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    startDelete(async () => {
      await deleteOpportunity(opportunityId);
      router.push("/deals");
    });
  }

  const contactName = contact ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") : "";

  return (
    <div className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-border">
      <div className="flex items-center gap-1.5 text-[13px] text-subtle">
        <Link href="/deals" className="hover:text-foreground transition-colors">
          Opportunities
        </Link>
        <span>/</span>
        <span className="text-foreground">{name}</span>
        <span className="ml-1">
          ({index}/{total} in By Stage → {stage})
        </span>
        {taskError && <span className="ml-3 text-red-400">{taskError}</span>}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={openCompose}
          disabled={!contact}
          title={contact ? undefined : "No point of contact on this deal"}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[13px] hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Mail size={14} strokeWidth={1.75} />
          Send Email
        </button>
        <button
          onClick={() => setCreatingTask(true)}
          disabled={!contact}
          title={contact ? undefined : "No point of contact on this deal"}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[13px] hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <CheckSquare size={14} strokeWidth={1.75} />
          New Task
        </button>
        <FavoriteButton
          entityType="opportunity"
          entityId={opportunityId}
          name={name}
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

      {draft && <EmailComposer draft={draft} mailboxes={mailboxes} onClose={() => setDraft(null)} />}
      {creatingTask && contact && (
        <CreateTaskPanel
          relatedTo={contactName}
          onClose={() => setCreatingTask(false)}
          onCreate={handleCreateTask}
        />
      )}
    </div>
  );
}
