"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PipelineStage } from "@prisma/client";
import { Mail, MoreHorizontal, Handshake, GitBranch, Trash2 } from "lucide-react";
import { ConvertToOpportunityPanel, type NewOpportunityDraft } from "@/components/convert-to-opportunity-panel";
import { AddToSequencePanel } from "@/components/add-to-sequence-panel";
import { FavoriteButton } from "@/components/favorite-button";
import { EmailComposer, type ComposerDraft, type MailboxOption } from "@/components/email-composer";
import { convertContactToOpportunity } from "@/lib/actions/opportunities";
import { deleteContacts } from "@/lib/actions/contacts";

export function ContactHeaderBar({
  contactId,
  name,
  index,
  total,
  companyName,
  personEmail,
  stages,
  isFavorited,
  mailboxes,
}: {
  contactId: string;
  name: string;
  index: number;
  total: number;
  companyName: string | null;
  personEmail: string | null;
  stages: PipelineStage[];
  isFavorited: boolean;
  mailboxes: MailboxOption[];
}) {
  const router = useRouter();
  const [converting, setConverting] = useState(false);
  const [addingToSequence, setAddingToSequence] = useState(false);
  const [draft, setDraft] = useState<ComposerDraft | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [pending, startTransition] = useTransition();

  function handleCreate(draft: NewOpportunityDraft) {
    startTransition(async () => {
      await convertContactToOpportunity({
        personId: contactId,
        name: draft.name,
        stage: draft.stage,
        value: draft.value,
      });
    });
  }

  function openCompose() {
    setDraft({ personId: contactId, to: personEmail ? [personEmail] : [], contactFirstName: name.split(" ")[0] });
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
    <div className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-border">
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
    </div>
  );
}
