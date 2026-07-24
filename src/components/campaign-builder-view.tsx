"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EmailTemplate } from "@prisma/client";
import { Search, Check, X, Megaphone, Users, KanbanSquare, ListChecks, ArrowRight, ArrowLeft, Inbox, Send, Clock, Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { RichTextEditor } from "@/components/rich-text-editor";
import { CampaignDashboardView } from "@/components/campaign-dashboard-view";
import { listTemplates } from "@/lib/actions/emails";
import { listTemplateVariables, type TemplateVariable } from "@/lib/template-variables";
import {
  searchContactsForCampaign,
  searchDealsForCampaign,
  addContactToCampaign,
  addDealToCampaign,
  addManyContactsToCampaign,
  addManyDealsToCampaign,
  listAttachableListsForCampaign,
  addListToCampaign,
  removeMemberFromCampaign,
  getActiveMailboxAccountsForCampaign,
  setCampaignMailboxes,
  listCampaignVariants,
  addCampaignVariant,
  renameCampaignVariant,
  deleteCampaignVariant,
  listCampaignSteps,
  addCampaignStep,
  deleteCampaignStep,
  setCampaignStepBody,
  previewCampaignStepBody,
  getCampaignReadiness,
  startCampaign,
  type CampaignPersonRow,
  type CampaignDealRow,
  type CampaignListOption,
  type CampaignReadiness,
  type CampaignStepInput,
} from "@/lib/actions/campaigns";

type Campaign = {
  id: string;
  name: string;
  status: string;
  members: {
    id: string;
    personId: string;
    person: {
      id: string;
      firstName: string;
      lastName: string | null;
      email: string | null;
      company: { name: string } | null;
    };
  }[];
};

type Tab = "contacts" | "deals" | "lists";
type Step = "recipients" | "inboxes" | "variants" | "steps" | "progress";

export function CampaignBuilderView({ campaign }: { campaign: Campaign }) {
  const [step, setStep] = useState<Step>(campaign.status !== "draft" ? "progress" : "recipients");

  return (
    <div className="flex flex-col h-screen">
      <div className="h-12 shrink-0 flex items-center gap-2 px-6 border-b border-border">
        <Megaphone size={14} strokeWidth={1.5} className="text-subtle" />
        <span className="text-[13px] font-medium">{campaign.name}</span>
        <span
          className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium capitalize ${
            campaign.status === "active"
              ? "bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-accent"
              : "bg-muted text-subtle"
          }`}
        >
          {campaign.status === "active" ? "Sending" : campaign.status}
        </span>
        <div className="flex-1" />
        <StepIndicator step={step} onStep={setStep} />
      </div>

      <div key={step} className="flex-1 min-h-0 animate-step-in">
        {step === "recipients" ? (
          <RecipientsStep campaign={campaign} onNext={() => setStep("inboxes")} />
        ) : step === "inboxes" ? (
          <InboxesStep
            campaignId={campaign.id}
            onBack={() => setStep("recipients")}
            onNext={() => setStep("variants")}
          />
        ) : step === "variants" ? (
          <VariantsStep campaignId={campaign.id} onBack={() => setStep("inboxes")} onNext={() => setStep("steps")} />
        ) : step === "steps" ? (
          <StepsStep
            campaignId={campaign.id}
            campaignStatus={campaign.status}
            onBack={() => setStep("variants")}
            onStarted={() => setStep("progress")}
          />
        ) : (
          <ProgressStep campaignId={campaign.id} />
        )}
      </div>
    </div>
  );
}

// All 5 tabs are always clickable — once a campaign leaves "draft", Recipients/Inboxes/
// Variants/Steps become live-editing tools instead of a locked linear wizard.
function StepIndicator({ step, onStep }: { step: Step; onStep: (step: Step) => void }) {
  const items: { key: Step; label: string }[] = [
    { key: "recipients", label: "1. Recipients" },
    { key: "inboxes", label: "2. Inboxes" },
    { key: "variants", label: "3. Variants" },
    { key: "steps", label: "4. Steps" },
    { key: "progress", label: "5. Progress" },
  ];
  return (
    <div className="flex items-center gap-2 text-[12px]">
      {items.map((item, i) => (
        <span key={item.key} className="flex items-center gap-2">
          {i > 0 && <span className="text-subtle">→</span>}
          <button
            onClick={() => onStep(item.key)}
            className={step === item.key ? "text-foreground font-medium" : "text-subtle hover:text-foreground transition-colors"}
          >
            {item.label}
          </button>
        </span>
      ))}
    </div>
  );
}

function ProgressStep({ campaignId }: { campaignId: string }) {
  return <CampaignDashboardView campaign={{ id: campaignId }} />;
}

const PAGE_SIZE_OPTIONS = [50, 100, 200] as const;

function RecipientsStep({ campaign, onNext }: { campaign: Campaign; onNext: () => void }) {
  const [tab, setTab] = useState<Tab>("contacts");
  const [query, setQuery] = useState("");
  const [contactRows, setContactRows] = useState<CampaignPersonRow[]>([]);
  const [dealRows, setDealRows] = useState<CampaignDealRow[]>([]);
  const [listRows, setListRows] = useState<CampaignListOption[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  // Opt-in, off by default — the user chooses to hide leads already in other campaigns
  // rather than being forced to; unrelated to the "unavailable" Sequence block, which
  // always applies.
  const [hideInOtherCampaigns, setHideInOtherCampaigns] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Setters below reset page to 1 whenever the search narrows or the filter/tab/page-size
  // changes — a stale page number from a wider result set could otherwise point past the
  // end of a narrower one.
  function changeTab(next: Tab) {
    setTab(next);
    setPage(1);
  }
  function changeQuery(next: string) {
    setQuery(next);
    setPage(1);
  }
  function changeHideInOtherCampaigns(next: boolean) {
    setHideInOtherCampaigns(next);
    setPage(1);
  }
  function changePageSize(next: number) {
    setPageSize(next);
    setPage(1);
  }

  useEffect(() => {
    const options = { page, pageSize, hideInOtherCampaigns };
    if (tab === "contacts") {
      searchContactsForCampaign(campaign.id, query, options).then((r) => {
        setContactRows(r.rows);
        setTotal(r.total);
      });
    } else if (tab === "deals") {
      searchDealsForCampaign(campaign.id, query, options).then((r) => {
        setDealRows(r.rows);
        setTotal(r.total);
      });
    } else {
      listAttachableListsForCampaign().then(setListRows);
    }
  }, [campaign.id, tab, query, page, pageSize, hideInOtherCampaigns]);

  function refresh() {
    router.refresh();
    const options = { page, pageSize, hideInOtherCampaigns };
    if (tab === "contacts") searchContactsForCampaign(campaign.id, query, options).then((r) => { setContactRows(r.rows); setTotal(r.total); });
    else if (tab === "deals") searchDealsForCampaign(campaign.id, query, options).then((r) => { setDealRows(r.rows); setTotal(r.total); });
    else listAttachableListsForCampaign().then(setListRows);
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  function attachList(listId: string) {
    startTransition(async () => {
      await addListToCampaign(campaign.id, listId);
      refresh();
    });
  }

  function toggleContact(row: CampaignPersonRow) {
    if (row.unavailable) return;
    startTransition(async () => {
      if (row.alreadyInCampaign) await removeMemberFromCampaign(campaign.id, row.id);
      else await addContactToCampaign(campaign.id, row.id);
      refresh();
    });
  }

  function toggleDeal(row: CampaignDealRow) {
    if (row.unavailable) return;
    startTransition(async () => {
      if (row.alreadyInCampaign) await removeMemberFromCampaign(campaign.id, row.contactId);
      else await addDealToCampaign(campaign.id, row.id, row.contactId);
      refresh();
    });
  }

  function removeMember(personId: string) {
    startTransition(async () => {
      await removeMemberFromCampaign(campaign.id, personId);
      refresh();
    });
  }

  const selectable = tab === "contacts" ? contactRows.filter((r) => !r.unavailable) : dealRows.filter((r) => !r.unavailable);
  const allSelected = selectable.length > 0 && selectable.every((r) => r.alreadyInCampaign);

  function toggleSelectAll() {
    startTransition(async () => {
      if (allSelected) {
        await Promise.all(selectable.map((r) => removeMemberFromCampaign(campaign.id, tab === "contacts" ? r.id : (r as CampaignDealRow).contactId)));
      } else if (tab === "contacts") {
        const toAdd = (selectable as CampaignPersonRow[]).filter((r) => !r.alreadyInCampaign).map((r) => r.id);
        await addManyContactsToCampaign(campaign.id, toAdd);
      } else {
        const toAdd = (selectable as CampaignDealRow[])
          .filter((r) => !r.alreadyInCampaign)
          .map((r) => ({ opportunityId: r.id, personId: r.contactId }));
        await addManyDealsToCampaign(campaign.id, toAdd);
      }
      refresh();
    });
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 flex flex-col border-r border-border">
        <div className="h-11 shrink-0 flex items-center gap-1 px-6 border-b border-border">
          <button
            onClick={() => changeTab("contacts")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] transition-colors ${
              tab === "contacts" ? "bg-muted text-foreground font-medium" : "text-subtle hover:text-foreground"
            }`}
          >
            <Users size={14} strokeWidth={1.5} />
            Contacts
          </button>
          <button
            onClick={() => changeTab("deals")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] transition-colors ${
              tab === "deals" ? "bg-muted text-foreground font-medium" : "text-subtle hover:text-foreground"
            }`}
          >
            <KanbanSquare size={14} strokeWidth={1.5} />
            Deals
          </button>
          <button
            onClick={() => changeTab("lists")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] transition-colors ${
              tab === "lists" ? "bg-muted text-foreground font-medium" : "text-subtle hover:text-foreground"
            }`}
          >
            <ListChecks size={14} strokeWidth={1.5} />
            Lists
          </button>
        </div>

        {tab !== "lists" && (
          <div className="p-3 border-b border-border flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border">
              <Search size={14} strokeWidth={1.5} className="text-subtle shrink-0" />
              <input
                value={query}
                onChange={(e) => changeQuery(e.target.value)}
                placeholder={tab === "contacts" ? "Search contacts…" : "Search deals…"}
                className="flex-1 min-w-0 text-[13px] outline-none bg-transparent placeholder:text-subtle"
              />
            </div>
          </div>
        )}

        {tab !== "lists" && (
          <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-2 border-b border-border">
            <label className="flex items-center gap-2 text-[12px] text-subtle cursor-pointer">
              <Checkbox checked={hideInOtherCampaigns} onClick={() => changeHideInOtherCampaigns(!hideInOtherCampaigns)} />
              Hide leads already in other campaigns
            </label>
            <label className="flex items-center gap-1.5 text-[12px] text-subtle shrink-0">
              Per page
              <select
                value={pageSize}
                onChange={(e) => changePageSize(Number(e.target.value))}
                className="px-1.5 py-0.5 rounded-md border border-border text-[12px] outline-none bg-transparent"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n} className="bg-background text-foreground">
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {tab !== "lists" && (
          <label className="shrink-0 flex items-center gap-3 px-6 py-2 border-b border-border text-[12px] text-subtle cursor-pointer hover:bg-muted/40 transition-colors">
            <Checkbox checked={allSelected} onClick={toggleSelectAll} disabled={pending || selectable.length === 0} />
            Select all {tab === "contacts" ? "contacts" : "deals"} in view · page {page} of {pageCount}
          </label>
        )}

        <div className="flex-1 min-h-0 overflow-auto">
          {tab === "lists" ? (
            listRows.length === 0 ? (
              <p className="text-[13px] text-subtle text-center py-8">
                No person or deal lists yet. Create one from Lists.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {listRows.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => attachList(l.id)}
                    disabled={pending || l.count === 0}
                    title={l.count === 0 ? "List is empty" : "Add every member of this list as a recipient"}
                    className="w-full flex items-center gap-3 px-6 py-2.5 hover:bg-muted/40 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {l.entityType === "person" ? (
                      <Users size={14} strokeWidth={1.5} className="text-subtle shrink-0" />
                    ) : (
                      <KanbanSquare size={14} strokeWidth={1.5} className="text-subtle shrink-0" />
                    )}
                    <span className="flex-1 min-w-0">
                      <p className="text-[13px] truncate">{l.name}</p>
                      <p className="text-[12px] text-subtle truncate">
                        {l.count} {l.entityType === "person" ? "contact" : "deal"}{l.count === 1 ? "" : "s"}
                      </p>
                    </span>
                    <span className="text-[11px] text-subtle shrink-0">Add all</span>
                  </button>
                ))}
              </div>
            )
          ) : (tab === "contacts" ? contactRows : dealRows).length === 0 ? (
            <p className="text-[13px] text-subtle text-center py-8">No results.</p>
          ) : (
            <div className="divide-y divide-border">
              {tab === "contacts"
                ? contactRows.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => toggleContact(r)}
                      disabled={pending || r.unavailable}
                      title={r.unavailable ? "Already enrolled in an active sequence" : undefined}
                      className="w-full flex items-center gap-3 px-6 py-2.5 hover:bg-muted/40 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Checkbox checked={r.alreadyInCampaign} />
                      <span className="flex-1 min-w-0">
                        <p className="text-[13px] truncate">{r.name}</p>
                        {r.subtitle && <p className="text-[12px] text-subtle truncate">{r.subtitle}</p>}
                      </span>
                      {r.unavailable && <span className="text-[11px] text-subtle shrink-0">Already enrolled</span>}
                    </button>
                  ))
                : dealRows.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => toggleDeal(r)}
                      disabled={pending || r.unavailable}
                      title={r.unavailable ? "Contact already enrolled in an active sequence" : undefined}
                      className="w-full flex items-center gap-3 px-6 py-2.5 hover:bg-muted/40 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Checkbox checked={r.alreadyInCampaign} />
                      <span className="flex-1 min-w-0">
                        <p className="text-[13px] truncate">{r.name}</p>
                        {r.subtitle && <p className="text-[12px] text-subtle truncate">{r.subtitle}</p>}
                      </span>
                      {r.unavailable && <span className="text-[11px] text-subtle shrink-0">Contact already enrolled</span>}
                    </button>
                  ))}
            </div>
          )}
        </div>

        {tab !== "lists" && pageCount > 1 && <PaginationBar page={page} pageCount={pageCount} onPage={setPage} />}
      </div>

      <div className="w-72 shrink-0 flex flex-col">
        <div className="h-11 shrink-0 flex items-center px-4 border-b border-border">
          <span className="text-[13px] font-medium">Recipients · {campaign.members.length}</span>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          {campaign.members.length === 0 ? (
            <p className="text-[13px] text-subtle text-center py-8 px-4">
              No recipients yet. Add contacts or deals from the left.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {campaign.members.map((m) => (
                <div key={m.id} className="flex items-center gap-2 px-4 py-2.5 group">
                  <span className="flex-1 min-w-0">
                    <p className="text-[13px] truncate">
                      {[m.person.firstName, m.person.lastName].filter(Boolean).join(" ")}
                    </p>
                    <p className="text-[12px] text-subtle truncate">
                      {[m.person.email, m.person.company?.name].filter(Boolean).join(" · ")}
                    </p>
                  </span>
                  <button
                    onClick={() => removeMember(m.personId)}
                    title="Remove"
                    className="p-1 rounded text-subtle opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity shrink-0"
                  >
                    <X size={13} strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-3 border-t border-border">
          <button
            onClick={onNext}
            disabled={campaign.members.length === 0}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next: Select Inboxes
            <ArrowRight size={14} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

type MailboxOption = {
  id: string;
  label: string;
  email: string;
  smtpStatus: string | null;
  selected: boolean;
};

function InboxesStep({
  campaignId,
  onBack,
  onNext,
}: {
  campaignId: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const [options, setOptions] = useState<MailboxOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    getActiveMailboxAccountsForCampaign(campaignId).then((opts) => {
      setOptions(opts);
      setLoaded(true);
    });
  }, [campaignId]);

  const selectedCount = useMemo(() => options.filter((o) => o.selected).length, [options]);

  function toggle(id: string) {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, selected: !o.selected } : o)));
  }

  function save() {
    startTransition(async () => {
      await setCampaignMailboxes(campaignId, options.filter((o) => o.selected).map((o) => o.id));
      onNext();
    });
  }

  return (
    <div className="flex flex-col h-full max-w-xl mx-auto">
      <div className="px-6 pt-6 pb-2">
        <h2 className="text-[15px] font-medium">Select Inboxes</h2>
        <p className="text-[13px] text-subtle mt-1">
          Choose which connected outreach mailboxes will send this campaign. Sends rotate across the inboxes you pick.
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-6 py-2">
        {!loaded ? (
          <p className="text-[13px] text-subtle text-center py-8">Loading…</p>
        ) : options.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12">
            <Inbox size={24} strokeWidth={1.5} className="text-subtle" />
            <p className="text-[13px] text-subtle mt-3">No active outreach mailboxes connected.</p>
            <a
              href="/settings/accounts/outreach-inboxes"
              className="text-[13px] text-accent hover:opacity-80 transition-opacity mt-1"
            >
              Connect one in Settings →
            </a>
          </div>
        ) : (
          <div className="border border-border rounded-md overflow-hidden">
            {options.map((o) => (
              <button
                key={o.id}
                onClick={() => toggle(o.id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors text-left"
              >
                <Checkbox checked={o.selected} />
                <span className="flex-1 min-w-0">
                  <p className="text-[13px] truncate">{o.label}</p>
                  <p className="text-[12px] text-subtle truncate">{o.email}</p>
                </span>
                {o.smtpStatus === "error" && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-500 text-white shrink-0">
                    Connection error
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-border flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md text-[13px] text-subtle hover:bg-muted transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={2} />
          Back
        </button>
        <div className="flex-1" />
        <span className="text-[12px] text-subtle">{selectedCount} selected</span>
        <button
          onClick={save}
          disabled={pending || selectedCount === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next: Select Template
          <ArrowRight size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

type VariantRow = { id: string; name: string; order: number };

function VariantsStep({
  campaignId,
  onBack,
  onNext,
}: {
  campaignId: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [pending, startTransition] = useTransition();

  function refresh() {
    listCampaignVariants(campaignId).then((v) => {
      setVariants(v);
      setLoaded(true);
    });
  }

  useEffect(refresh, [campaignId]);

  function add() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    startTransition(async () => {
      await addCampaignVariant(campaignId, trimmed);
      setNewName("");
      refresh();
    });
  }

  function saveRename() {
    if (!editingId) return;
    const trimmed = editingName.trim();
    if (!trimmed) return;
    startTransition(async () => {
      await renameCampaignVariant(editingId, trimmed);
      setEditingId(null);
      refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteCampaignVariant(id);
      refresh();
    });
  }

  return (
    <div className="flex flex-col h-full max-w-xl mx-auto">
      <div className="px-6 pt-6 pb-2">
        <h2 className="text-[15px] font-medium">Template Variants</h2>
        <p className="text-[13px] text-subtle mt-1">
          Add one or more variants to A/N test — each recipient is randomly assigned to exactly one variant and stays
          on it for every step. Content for each variant is written in the next step.
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-6 py-2">
        {!loaded ? (
          <p className="text-[13px] text-subtle text-center py-8">Loading…</p>
        ) : (
          <div className="border border-border rounded-md overflow-hidden">
            {variants.length === 0 ? (
              <p className="text-[13px] text-subtle text-center py-8">No variants yet — add one below.</p>
            ) : (
              variants.map((v) => (
                <div key={v.id} className="flex items-center gap-2 px-4 py-2.5 border-b border-border last:border-b-0">
                  {editingId === v.id ? (
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveRename()}
                      onBlur={saveRename}
                      className="flex-1 min-w-0 text-[13px] outline-none bg-transparent border-b border-accent"
                    />
                  ) : (
                    <span className="flex-1 min-w-0 text-[13px] truncate">{v.name}</span>
                  )}
                  <button
                    onClick={() => {
                      setEditingId(v.id);
                      setEditingName(v.name);
                    }}
                    className="p-1 rounded text-subtle hover:text-foreground transition-colors shrink-0"
                  >
                    <Pencil size={13} strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() => remove(v.id)}
                    disabled={pending}
                    className="p-1 rounded text-subtle hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 size={13} strokeWidth={1.5} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        <div className="flex items-center gap-2 mt-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder={`Variant ${String.fromCharCode(65 + variants.length)}`}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent placeholder:text-subtle focus:border-accent transition-colors"
          />
          <button
            onClick={add}
            disabled={pending || !newName.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-[13px] hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={14} strokeWidth={2} />
            Add variant
          </button>
        </div>
      </div>

      <div className="p-3 border-t border-border flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md text-[13px] text-subtle hover:bg-muted transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={2} />
          Back
        </button>
        <div className="flex-1" />
        <button
          onClick={onNext}
          disabled={variants.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next: Steps
          <ArrowRight size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

type StepRow = { id: string; order: number; delayDays: number; delayHours: number };

function stepDelayLabel(delayDays: number, delayHours: number) {
  if (delayDays === 0 && delayHours === 0) return "Immediately";
  const parts = [];
  if (delayDays > 0) parts.push(`${delayDays}d`);
  if (delayHours > 0) parts.push(`${delayHours}h`);
  return `+${parts.join(" ")}`;
}

function StepsStep({
  campaignId,
  campaignStatus,
  onBack,
  onStarted,
}: {
  campaignId: string;
  campaignStatus: string;
  onBack: () => void;
  onStarted: () => void;
}) {
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function refresh() {
    Promise.all([listCampaignSteps(campaignId), listCampaignVariants(campaignId)]).then(([s, v]) => {
      setSteps(s);
      setVariants(v);
      setLoaded(true);
      setExpandedStepId((prev) => prev ?? s[0]?.id ?? null);
    });
  }

  useEffect(refresh, [campaignId]);

  function addStep(input: CampaignStepInput) {
    startTransition(async () => {
      const step = await addCampaignStep(campaignId, input);
      setExpandedStepId(step.id);
      refresh();
    });
  }

  function removeStep(id: string) {
    startTransition(async () => {
      await deleteCampaignStep(id);
      refresh();
    });
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      <div className="px-6 pt-6 pb-2">
        <h2 className="text-[15px] font-medium">Steps</h2>
        <p className="text-[13px] text-subtle mt-1">
          Each step sends after a delay from enrollment. Write content for every variant within a step.
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-6 py-2">
        {!loaded ? (
          <p className="text-[13px] text-subtle text-center py-8">Loading…</p>
        ) : (
          <div className="space-y-3">
            {steps.map((s, i) => (
              <div key={s.id} className="border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedStepId(expandedStepId === s.id ? null : s.id)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/40 transition-colors text-left"
                >
                  {expandedStepId === s.id ? (
                    <ChevronDown size={14} strokeWidth={1.75} className="text-subtle shrink-0" />
                  ) : (
                    <ChevronRight size={14} strokeWidth={1.75} className="text-subtle shrink-0" />
                  )}
                  <span className="text-[13px] font-medium">Step {i + 1}</span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-subtle shrink-0">
                    {stepDelayLabel(s.delayDays, s.delayHours)}
                  </span>
                  <div className="flex-1" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeStep(s.id);
                    }}
                    disabled={pending}
                    className="p-1 rounded text-subtle hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 size={13} strokeWidth={1.5} />
                  </button>
                </button>

                {expandedStepId === s.id && (
                  <div className="border-t border-border">
                    <StepVariantGrid stepId={s.id} variants={variants} />
                  </div>
                )}
              </div>
            ))}

            <AddStepRow onAdd={addStep} pending={pending} />
          </div>
        )}
      </div>

      <div className="p-3 border-t border-border flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md text-[13px] text-subtle hover:bg-muted transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={2} />
          Back
        </button>
        <div className="flex-1" />
        {campaignStatus === "draft" && (
          <button
            onClick={() => setConfirming(true)}
            disabled={steps.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Finish
            <Send size={14} strokeWidth={2} />
          </button>
        )}
      </div>

      {confirming && (
        <StartCampaignModal
          campaignId={campaignId}
          onCancel={() => setConfirming(false)}
          onStarted={() => {
            setConfirming(false);
            onStarted();
          }}
        />
      )}
    </div>
  );
}

function AddStepRow({ onAdd, pending }: { onAdd: (input: CampaignStepInput) => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const [delayDays, setDelayDays] = useState(0);
  const [delayHours, setDelayHours] = useState(0);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-dashed border-border text-[13px] text-subtle hover:bg-muted hover:text-foreground transition-colors"
      >
        <Plus size={14} strokeWidth={2} />
        Add step
      </button>
    );
  }

  return (
    <div className="border border-border rounded-lg p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[12px] text-subtle">Days after enrollment</span>
          <input
            type="number"
            min={0}
            value={delayDays}
            onChange={(e) => setDelayDays(Number(e.target.value) || 0)}
            className="mt-1 w-full px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent focus:border-accent transition-colors"
          />
        </label>
        <label className="block">
          <span className="text-[12px] text-subtle">Hours</span>
          <input
            type="number"
            min={0}
            max={23}
            value={delayHours}
            onChange={(e) => setDelayHours(Number(e.target.value) || 0)}
            className="mt-1 w-full px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent focus:border-accent transition-colors"
          />
        </label>
      </div>
      <div className="flex items-center justify-end gap-2 mt-4">
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-md text-[13px] text-subtle hover:bg-muted transition-colors">
          Cancel
        </button>
        <button
          onClick={() => {
            onAdd({ delayDays: Math.max(0, delayDays), delayHours: Math.max(0, delayHours) });
            setOpen(false);
            setDelayDays(0);
            setDelayHours(0);
          }}
          disabled={pending}
          className="px-3 py-1.5 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Add step
        </button>
      </div>
    </div>
  );
}

function StepVariantGrid({ stepId, variants }: { stepId: string; variants: VariantRow[] }) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  // Derived, not stored: falls back to the first variant whenever the selection points at
  // a variant that no longer exists (e.g. it was just deleted), without a setState-in-effect.
  const activeVariantId = variants.some((v) => v.id === selectedVariantId) ? selectedVariantId! : variants[0]?.id ?? "";

  if (variants.length === 0) {
    return <p className="text-[13px] text-subtle text-center py-6 px-4">Add a variant first.</p>;
  }

  return (
    <div>
      <div className="flex items-center gap-1 px-3 pt-3">
        {variants.map((v) => (
          <button
            key={v.id}
            onClick={() => setSelectedVariantId(v.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] transition-colors ${
              activeVariantId === v.id ? "bg-muted text-foreground font-medium" : "text-subtle hover:text-foreground"
            }`}
          >
            {v.name}
          </button>
        ))}
      </div>
      {activeVariantId && (
        <div className="p-3">
          <StepBodyEditor key={`${stepId}:${activeVariantId}`} stepId={stepId} variantId={activeVariantId} />
        </div>
      )}
    </div>
  );
}

function StepBodyEditor({ stepId, variantId }: { stepId: string; variantId: string }) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [preview, setPreview] = useState<{ subject: string; bodyHtml: string; previewedFor: string | null } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    Promise.all([listTemplates(), listTemplateVariables()]).then(([t, v]) => {
      setTemplates(t);
      setVariables(v);
    });
    // Every prop, including stepId/variantId, is fixed for this component's whole
    // lifetime — the caller remounts it via a `key={stepId:variantId}` on switch, so no
    // reset-on-prop-change effect is needed here; a fresh instance already starts fresh.
  }, []);

  function save() {
    startTransition(async () => {
      await setCampaignStepBody(stepId, variantId, {
        templateId: templateId || null,
        subject: templateId ? undefined : subject,
        bodyHtml: templateId ? undefined : bodyHtml,
      });
      setSaved(true);
    });
  }

  function togglePreview() {
    if (showPreview) {
      setShowPreview(false);
      return;
    }
    previewCampaignStepBody(stepId, variantId).then(setPreview);
    setShowPreview(true);
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-[12px] text-subtle">Use a template</span>
        <select
          value={templateId}
          onChange={(e) => {
            setTemplateId(e.target.value);
            setSaved(false);
          }}
          className="mt-1 w-full px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent"
        >
          <option value="" className="bg-background text-foreground">
            Write custom email instead
          </option>
          {templates.map((t) => (
            <option key={t.id} value={t.id} className="bg-background text-foreground">
              {t.name}
            </option>
          ))}
        </select>
      </label>

      {!templateId && (
        <>
          <label className="block">
            <span className="text-[12px] text-subtle">Subject</span>
            <input
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setSaved(false);
              }}
              placeholder="e.g. Following up, {{person.firstName}}"
              className="w-full mt-1 px-2.5 py-1.5 rounded-md border border-border text-[13px] outline-none bg-transparent placeholder:text-subtle focus:border-accent transition-colors"
            />
          </label>
          <div>
            <span className="text-[12px] text-subtle">Body</span>
            <RichTextEditor
              value={bodyHtml}
              onChange={(v) => {
                setBodyHtml(v);
                setSaved(false);
              }}
              placeholder="Write the email... use the {{ }} button to insert variables"
              className="mt-1 h-48"
              variables={variables}
            />
          </div>
        </>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={pending || (!templateId && !subject.trim())}
          className="px-3 py-1.5 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saved ? "Saved" : "Save"}
        </button>
        <button
          onClick={togglePreview}
          className="px-3 py-1.5 rounded-md border border-border text-[13px] hover:bg-muted transition-colors"
        >
          {showPreview ? "Hide preview" : "Preview"}
        </button>
      </div>

      {showPreview && (
        <div className="mt-2 border border-border rounded-md p-3 bg-surface">
          {!preview ? (
            <p className="text-[13px] text-subtle">Loading preview…</p>
          ) : (
            <>
              {!preview.previewedFor && (
                <p className="text-[12px] text-subtle mb-2">
                  No recipients yet — showing raw content with unmerged {"{{"}variables{"}}"}.
                </p>
              )}
              <p className="text-[13px] font-medium mb-2">{preview.subject}</p>
              <div className="text-[13px] [&_a]:text-accent" dangerouslySetInnerHTML={{ __html: preview.bodyHtml }} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StartCampaignModal({
  campaignId,
  onCancel,
  onStarted,
}: {
  campaignId: string;
  onCancel: () => void;
  onStarted: () => void;
}) {
  const [readiness, setReadiness] = useState<CampaignReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    getCampaignReadiness(campaignId).then(setReadiness);
  }, [campaignId]);

  function confirm() {
    setError(null);
    startTransition(async () => {
      try {
        await startCampaign(campaignId);
        onStarted();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-lg border border-border bg-surface shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[15px] font-medium">Start this campaign now?</h2>

        {!readiness ? (
          <p className="text-[13px] text-subtle mt-3">Checking…</p>
        ) : (
          <>
            <p className="text-[13px] text-subtle mt-2">
              {readiness.recipientCount} recipient{readiness.recipientCount === 1 ? "" : "s"} · {readiness.mailboxCount}{" "}
              inbox{readiness.mailboxCount === 1 ? "" : "es"} · {readiness.stepCount} step{readiness.stepCount === 1 ? "" : "s"} ·{" "}
              {readiness.variantCount} variant{readiness.variantCount === 1 ? "" : "s"}
            </p>
            <div className="flex items-start gap-2 mt-3 text-[12px] text-subtle bg-muted rounded-md p-3">
              <Clock size={14} strokeWidth={1.5} className="shrink-0 mt-0.5" />
              <span>
                Emails are sent gradually, one every 30–60 seconds, so this won&apos;t look like a bulk blast. The full
                send will take roughly{" "}
                {Math.round((readiness.recipientCount * 45) / 60) || 1} minute
                {Math.round((readiness.recipientCount * 45) / 60) === 1 ? "" : "s"}.
              </span>
            </div>
            {!readiness.ready && (
              <p className="text-[13px] text-red-400 mt-3">{readiness.reason}</p>
            )}
          </>
        )}

        {error && <p className="text-[13px] text-red-400 mt-3">{error}</p>}

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md text-[13px] text-subtle hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={pending || !readiness?.ready}
            className="px-3 py-1.5 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? "Starting…" : "Start now"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Windowed page numbers (1 2 3 4 … N), not every page — a workspace with thousands of
// contacts at pageSize 50 would otherwise render dozens of page buttons.
function pageWindow(page: number, pageCount: number): (number | "…")[] {
  const window = 2;
  const pages = new Set<number>([1, pageCount]);
  for (let p = page - window; p <= page + window; p++) {
    if (p >= 1 && p <= pageCount) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("…");
    result.push(sorted[i]);
  }
  return result;
}

function PaginationBar({ page, pageCount, onPage }: { page: number; pageCount: number; onPage: (page: number) => void }) {
  return (
    <div className="shrink-0 flex items-center justify-center gap-1 px-3 py-2 border-t border-border">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="p-1.5 rounded-md text-subtle hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ArrowLeft size={14} strokeWidth={2} />
      </button>
      {pageWindow(page, pageCount).map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="px-1.5 text-[12px] text-subtle">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={`min-w-[26px] px-1.5 py-1 rounded-md text-[12px] transition-colors ${
              p === page ? "bg-accent text-white font-medium" : "text-subtle hover:bg-muted hover:text-foreground"
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= pageCount}
        className="p-1.5 rounded-md text-subtle hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ArrowRight size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

function Checkbox({
  checked,
  onClick,
  disabled,
}: {
  checked: boolean;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
}) {
  return (
    <span
      onClick={(e) => {
        if (disabled) return;
        onClick?.(e);
      }}
      className={`size-4 shrink-0 rounded border flex items-center justify-center ${
        checked ? "bg-accent border-accent" : "border-border"
      } ${disabled ? "opacity-50" : ""}`}
    >
      {checked && <Check size={12} strokeWidth={2.5} className="text-white" />}
    </span>
  );
}
