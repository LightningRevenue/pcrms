"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Check, X, Megaphone, Users, KanbanSquare, ArrowRight, ArrowLeft, Inbox, FileText, Send, Clock } from "lucide-react";
import {
  searchContactsForCampaign,
  searchDealsForCampaign,
  addContactToCampaign,
  addDealToCampaign,
  addManyContactsToCampaign,
  addManyDealsToCampaign,
  removeMemberFromCampaign,
  getActiveMailboxAccountsForCampaign,
  setCampaignMailboxes,
  listEmailTemplatesForCampaign,
  setCampaignTemplate,
  previewCampaignTemplate,
  getCampaignReadiness,
  startCampaign,
  getCampaignProgress,
  type CampaignPersonRow,
  type CampaignDealRow,
  type CampaignTemplateOption,
  type CampaignReadiness,
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

type Tab = "contacts" | "deals";
type Step = "recipients" | "inboxes" | "template";

export function CampaignBuilderView({ campaign }: { campaign: Campaign }) {
  const [step, setStep] = useState<Step>("recipients");

  return (
    <div className="flex flex-col h-screen">
      <div className="h-12 shrink-0 flex items-center gap-2 px-6 border-b border-border">
        <Megaphone size={14} strokeWidth={1.5} className="text-subtle" />
        <span className="text-[13px] font-medium">{campaign.name}</span>
        <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium capitalize bg-muted text-subtle">
          {campaign.status}
        </span>
        <div className="flex-1" />
        <StepIndicator step={step} />
      </div>

      <div key={step} className="flex-1 min-h-0 animate-step-in">
        {step === "recipients" ? (
          <RecipientsStep campaign={campaign} onNext={() => setStep("inboxes")} />
        ) : step === "inboxes" ? (
          <InboxesStep
            campaignId={campaign.id}
            onBack={() => setStep("recipients")}
            onNext={() => setStep("template")}
          />
        ) : (
          <TemplateStep campaignId={campaign.id} campaignStatus={campaign.status} onBack={() => setStep("inboxes")} />
        )}
      </div>
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span className={step === "recipients" ? "text-foreground font-medium" : "text-subtle"}>1. Recipients</span>
      <span className="text-subtle">→</span>
      <span className={step === "inboxes" ? "text-foreground font-medium" : "text-subtle"}>2. Inboxes</span>
      <span className="text-subtle">→</span>
      <span className={step === "template" ? "text-foreground font-medium" : "text-subtle"}>3. Template</span>
    </div>
  );
}

function RecipientsStep({ campaign, onNext }: { campaign: Campaign; onNext: () => void }) {
  const [tab, setTab] = useState<Tab>("contacts");
  const [query, setQuery] = useState("");
  const [contactRows, setContactRows] = useState<CampaignPersonRow[]>([]);
  const [dealRows, setDealRows] = useState<CampaignDealRow[]>([]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (tab === "contacts") {
      searchContactsForCampaign(campaign.id, query).then(setContactRows);
    } else {
      searchDealsForCampaign(campaign.id, query).then(setDealRows);
    }
  }, [campaign.id, tab, query]);

  function refresh() {
    router.refresh();
    if (tab === "contacts") searchContactsForCampaign(campaign.id, query).then(setContactRows);
    else searchDealsForCampaign(campaign.id, query).then(setDealRows);
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
            onClick={() => setTab("contacts")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] transition-colors ${
              tab === "contacts" ? "bg-muted text-foreground font-medium" : "text-subtle hover:text-foreground"
            }`}
          >
            <Users size={14} strokeWidth={1.5} />
            Contacts
          </button>
          <button
            onClick={() => setTab("deals")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] transition-colors ${
              tab === "deals" ? "bg-muted text-foreground font-medium" : "text-subtle hover:text-foreground"
            }`}
          >
            <KanbanSquare size={14} strokeWidth={1.5} />
            Deals
          </button>
        </div>

        <div className="p-3 border-b border-border flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border">
            <Search size={14} strokeWidth={1.5} className="text-subtle shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === "contacts" ? "Search contacts…" : "Search deals…"}
              className="flex-1 min-w-0 text-[13px] outline-none bg-transparent placeholder:text-subtle"
            />
          </div>
        </div>

        <label className="shrink-0 flex items-center gap-3 px-6 py-2 border-b border-border text-[12px] text-subtle cursor-pointer hover:bg-muted/40 transition-colors">
          <Checkbox checked={allSelected} onClick={toggleSelectAll} disabled={pending || selectable.length === 0} />
          Select all {tab === "contacts" ? "contacts" : "deals"} in view
        </label>

        <div className="flex-1 min-h-0 overflow-auto">
          {(tab === "contacts" ? contactRows : dealRows).length === 0 ? (
            <p className="text-[13px] text-subtle text-center py-8">No results.</p>
          ) : (
            <div className="divide-y divide-border">
              {tab === "contacts"
                ? contactRows.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => toggleContact(r)}
                      disabled={pending || r.unavailable}
                      title={r.unavailable ? "Already enrolled in a sequence or campaign" : undefined}
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
                      title={r.unavailable ? "Contact already enrolled in a sequence or campaign" : undefined}
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

function TemplateStep({
  campaignId,
  campaignStatus,
  onBack,
}: {
  campaignId: string;
  campaignStatus: string;
  onBack: () => void;
}) {
  const [templates, setTemplates] = useState<CampaignTemplateOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ subject: string; bodyHtml: string; previewedFor: string | null } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [started, setStarted] = useState(campaignStatus !== "draft");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    listEmailTemplatesForCampaign(campaignId).then((opts) => {
      setTemplates(opts);
      setSelectedId(opts.find((o) => o.selected)?.id ?? null);
      setLoaded(true);
    });
  }, [campaignId]);

  useEffect(() => {
    if (!selectedId) {
      setPreview(null);
      return;
    }
    previewCampaignTemplate(campaignId, selectedId).then(setPreview);
  }, [campaignId, selectedId]);

  function select(id: string) {
    setSelectedId(id);
    startTransition(() => setCampaignTemplate(campaignId, id));
  }

  if (started) {
    return <CampaignProgress campaignId={campaignId} />;
  }

  return (
    <div className="flex h-full">
      <div className="w-72 shrink-0 flex flex-col border-r border-border">
        <div className="h-11 shrink-0 flex items-center px-4 border-b border-border">
          <span className="text-[13px] font-medium">Select a template</span>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          {!loaded ? (
            <p className="text-[13px] text-subtle text-center py-8 px-4">Loading…</p>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12 px-4">
              <FileText size={24} strokeWidth={1.5} className="text-subtle" />
              <p className="text-[13px] text-subtle mt-3">No email templates yet.</p>
              <a
                href="/settings/email-templates"
                className="text-[13px] text-accent hover:opacity-80 transition-opacity mt-1"
              >
                Create one in Settings →
              </a>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => select(t.id)}
                  disabled={pending}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors text-left disabled:opacity-60"
                >
                  <Checkbox checked={selectedId === t.id} />
                  <span className="flex-1 min-w-0">
                    <p className="text-[13px] truncate">{t.name}</p>
                    <p className="text-[12px] text-subtle truncate">{t.subject}</p>
                  </span>
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
          <button
            onClick={() => setConfirming(true)}
            disabled={!selectedId}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Finish
            <Send size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="h-11 shrink-0 flex items-center px-6 border-b border-border">
          <span className="text-[13px] font-medium">Preview</span>
          {preview?.previewedFor && (
            <span className="text-[12px] text-subtle ml-2">merged for {preview.previewedFor}</span>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-auto px-6 py-4">
          {!selectedId ? (
            <p className="text-[13px] text-subtle text-center py-8">Pick a template to preview it.</p>
          ) : !preview ? (
            <p className="text-[13px] text-subtle text-center py-8">Loading preview…</p>
          ) : (
            <div className="max-w-2xl">
              {!preview.previewedFor && (
                <p className="text-[12px] text-subtle mb-3">
                  No recipients yet — showing raw template with unmerged {"{{"}variables{"}}"}.
                </p>
              )}
              <p className="text-[13px] font-medium mb-2">{preview.subject}</p>
              <div
                className="text-[13px] rounded-md border border-border p-4 bg-surface [&_a]:text-accent"
                dangerouslySetInnerHTML={{ __html: preview.bodyHtml }}
              />
            </div>
          )}
        </div>
      </div>

      {confirming && (
        <StartCampaignModal
          campaignId={campaignId}
          onCancel={() => setConfirming(false)}
          onStarted={() => {
            setConfirming(false);
            setStarted(true);
          }}
        />
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
              inbox{readiness.mailboxCount === 1 ? "" : "es"} · template &ldquo;{readiness.templateName}&rdquo;
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

function CampaignProgress({ campaignId }: { campaignId: string }) {
  const [progress, setProgress] = useState<{ total: number; pending: number; queued: number; sent: number; failed: number } | null>(null);

  useEffect(() => {
    getCampaignProgress(campaignId).then(setProgress);
  }, [campaignId]);

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <Send size={24} strokeWidth={1.5} className="text-accent" />
      <p className="text-[15px] font-medium mt-3">Campaign started</p>
      {progress && (
        <p className="text-[13px] text-subtle mt-1">
          {progress.sent} sent · {progress.queued + progress.pending} pending
          {progress.failed > 0 ? ` · ${progress.failed} failed` : ""} of {progress.total}
        </p>
      )}
      <p className="text-[12px] text-subtle mt-3 max-w-sm">
        Sends are trickling out in the background, 30–60s apart. Refresh this page to see updated progress.
      </p>
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
