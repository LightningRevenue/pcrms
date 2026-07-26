"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Opportunity, PipelineStage } from "@prisma/client";
import {
  Mail,
  MoreHorizontal,
  Handshake,
  CheckSquare,
  StickyNote,
  Trash2,
  X,
  Globe,
  Link2,
  UserCircle,
  Users,
  Banknote,
  Briefcase,
} from "lucide-react";
import { FavoriteButton } from "@/components/favorite-button";
import { EmailComposer, type ComposerDraft, type MailboxOption } from "@/components/email-composer";
import { CreateTaskPanel, type NewTaskDraft } from "@/components/create-task-panel";
import { CreateNotePanel } from "@/components/create-note-panel";
import { CreateDealPanel } from "@/components/create-deal-panel";
import { CompanyLogo } from "@/components/company-logo";
import { OwnerSelect } from "@/components/owner-select";
import { NameInput, HighlightField, ActionButton } from "@/components/highlights-primitives";
import { deleteCompanies, setCompanyOwner, updateCompanyField } from "@/lib/actions/companies";
import { createTask } from "@/lib/actions/tasks";
import { createNote } from "@/lib/actions/notes";

type WorkspaceUser = { id: string; name: string | null; email: string | null };
type ContactOption = { id: string; name: string; email: string | null };

// Company counterpart to LeadHighlightsBar: identity + the numbers you want before you open
// an account + the actions you'd take on it. Shares the small primitives, not the layout —
// a company has no phone, sequence or convert, and gains pipeline/headcount instead.
export function CompanyHighlightsBar({
  companyId,
  name: name0,
  domain,
  linkedin,
  annualRevenue,
  industry,
  employeeCount,
  ownerId,
  index,
  total,
  isFavorited,
  people,
  openPipeline,
  openDealCount,
  stages,
  opportunities,
  mailboxes,
  users,
}: {
  companyId: string;
  name: string;
  domain: string | null;
  linkedin: string | null;
  annualRevenue: string | null;
  industry: string | null;
  employeeCount: number | null;
  ownerId: string | null;
  index: number;
  total: number;
  isFavorited: boolean;
  people: ContactOption[];
  openPipeline: number;
  openDealCount: number;
  stages: PipelineStage[];
  opportunities: Opportunity[];
  mailboxes: MailboxOption[];
  users: WorkspaceUser[];
}) {
  const router = useRouter();
  const [name, setName] = useState(name0);
  const [draft, setDraft] = useState<ComposerDraft | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const [creatingNote, setCreatingNote] = useState(false);
  const [creatingDeal, setCreatingDeal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Tasks and notes hang off a Person in the schema, so company-level ones attach to the
  // first contact at the account. With no contacts there's nothing to attach to.
  const primaryContact = people[0] ?? null;
  const emailTarget = people.find((p) => p.email) ?? null;

  function save(field: "name" | "domain" | "linkedin" | "annualRevenue", value: string) {
    startTransition(() => updateCompanyField(companyId, field, value));
  }

  function openCompose() {
    if (!emailTarget?.email) return;
    setDraft({
      personId: emailTarget.id,
      to: [emailTarget.email],
      subject: "",
      contactFirstName: emailTarget.name.split(" ")[0],
    });
  }

  function handleCreateTask(task: NewTaskDraft) {
    if (!primaryContact) return;
    startTransition(async () => {
      await createTask({
        personId: primaryContact.id,
        title: task.title,
        description: task.description,
        type: task.type,
        priority: task.priority,
        due: task.due,
      });
    });
  }

  function handleCreateNote(body: string, opportunityIds: string[]) {
    if (!primaryContact) return;
    startTransition(async () => {
      await createNote(primaryContact.id, body, opportunityIds);
    });
  }

  function handleDelete() {
    setMenuOpen(false);
    startDelete(async () => {
      try {
        await deleteCompanies([companyId]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        return;
      }
      router.push("/companies");
    });
  }

  const noContactsTitle = primaryContact ? undefined : "Add a contact to this company first";

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
        <Link href="/companies" className="hover:text-foreground transition-colors">
          Companies
        </Link>
        <span>/</span>
        <span className="text-foreground">{name || "Untitled"}</span>
        <span className="ml-1">
          ({index}/{total})
        </span>
      </div>

      <div className="flex items-start justify-between gap-6 px-6 pt-1.5 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <CompanyLogo domain={domain} fallbackText={(name || "?").slice(0, 1)} size={28} />
            <div className="min-w-0">
              <NameInput
                value={name}
                onChange={setName}
                onCommit={(v) => v.trim() && v !== name0 && save("name", v)}
                placeholder="Company name"
              />
              <p className="text-[12px] text-subtle truncate">
                {[domain, annualRevenue].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-x-6 gap-y-1 mt-2.5">
            <HighlightField icon={Globe} label="Domain">
              {domain ? (
                <a
                  href={`https://${domain.replace(/^https?:\/\//, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-accent transition-colors truncate block"
                >
                  {domain}
                </a>
              ) : (
                <span className="text-subtle">—</span>
              )}
            </HighlightField>
            <HighlightField icon={UserCircle} label="Owner">
              <OwnerSelect
                users={users}
                ownerId={ownerId}
                onChange={(id) => startTransition(() => setCompanyOwner(companyId, id))}
              />
            </HighlightField>
            <HighlightField icon={Banknote} label="Open pipeline">
              {openDealCount > 0 ? (
                <span>
                  {new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: "EUR",
                    maximumFractionDigits: 0,
                  }).format(openPipeline)}
                  <span className="text-subtle"> · {openDealCount} deal{openDealCount === 1 ? "" : "s"}</span>
                </span>
              ) : (
                <span className="text-subtle">No open deals</span>
              )}
            </HighlightField>
            <HighlightField icon={Users} label="Contacts">
              {people.length > 0 ? people.length : <span className="text-subtle">—</span>}
            </HighlightField>
            <HighlightField icon={Briefcase} label="Industry">
              {industry || <span className="text-subtle">—</span>}
            </HighlightField>
            <HighlightField icon={Users} label="Employees">
              {employeeCount != null ? employeeCount.toLocaleString() : <span className="text-subtle">—</span>}
            </HighlightField>
            <HighlightField icon={Link2} label="LinkedIn">
              {linkedin ? (
                <a
                  href={linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-accent transition-colors truncate block"
                >
                  {linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/(company\/)?/, "")}
                </a>
              ) : (
                <span className="text-subtle">—</span>
              )}
            </HighlightField>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1.5">
          <ActionButton
            icon={Mail}
            label="Email"
            onClick={openCompose}
            disabled={!emailTarget}
            title={emailTarget ? undefined : "No contact at this company has an email address"}
          />
          <ActionButton
            icon={CheckSquare}
            label="Task"
            onClick={() => setCreatingTask(true)}
            disabled={!primaryContact}
            title={noContactsTitle}
          />
          <ActionButton
            icon={StickyNote}
            label="Note"
            onClick={() => setCreatingNote(true)}
            disabled={!primaryContact}
            title={noContactsTitle}
          />
          <ActionButton icon={Handshake} label="Deal" onClick={() => setCreatingDeal(true)} disabled={pending} />
          <FavoriteButton
            entityType="company"
            entityId={companyId}
            name={name || "Untitled"}
            href={`/companies/${companyId}`}
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

      {draft && <EmailComposer draft={draft} mailboxes={mailboxes} onClose={() => setDraft(null)} />}

      {creatingTask && primaryContact && (
        <CreateTaskPanel
          relatedTo={name || "Untitled"}
          opportunities={opportunities}
          onClose={() => setCreatingTask(false)}
          onCreate={handleCreateTask}
        />
      )}

      {creatingNote && primaryContact && (
        <CreateNotePanel
          relatedTo={name || "Untitled"}
          opportunities={opportunities}
          users={users}
          onClose={() => setCreatingNote(false)}
          onSave={handleCreateNote}
        />
      )}

      {creatingDeal && (
        <CreateDealPanel stages={stages} companyId={companyId} onClose={() => setCreatingDeal(false)} />
      )}
    </div>
  );
}
