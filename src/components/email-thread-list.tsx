"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Email, EmailOpen, EmailOpportunity, Opportunity } from "@prisma/client";
import { Reply, Plus, Inbox, RefreshCw, ChevronDown, Eye, User as UserIcon } from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import { EmailComposer, type ComposerDraft, type MailboxOption } from "@/components/email-composer";
import { AssociatedDeals } from "@/components/associated-deals";
import { syncContactEmails } from "@/lib/actions/emails";
import { useContactHref } from "@/lib/view-mode";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(
    date
  );
}

type EmailWithOpens = Email & {
  opens: EmailOpen[];
  opportunities: (EmailOpportunity & { opportunity: Opportunity })[];
  campaignMember?: { campaign: { id: string; name: string } } | null;
};

export function EmailThreadList({
  personId,
  personName,
  personEmail,
  emails,
  initialExpandedId,
  opportunities = [],
  mailboxes,
  context = "contact",
  defaultOpportunityId,
}: {
  personId: string;
  personName?: string;
  personEmail: string | null;
  emails: EmailWithOpens[];
  initialExpandedId?: string | null;
  opportunities?: Opportunity[];
  mailboxes: MailboxOption[];
  context?: "contact" | "opportunity";
  // Composing from a deal's own Emails tab should associate the new email with that deal
  // by default, same as the header bar's "Send Email" button — still editable via the
  // OpportunityMultiSelect if `opportunities` is passed.
  defaultOpportunityId?: string;
}) {
  const [draft, setDraft] = useState<ComposerDraft | null>(null);
  const [isSyncing, startSync] = useTransition();
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(initialExpandedId ?? null);
  const contactHref = useContactHref();

  function handleSync() {
    setSyncMessage(null);
    startSync(async () => {
      try {
        const count = await syncContactEmails(personId);
        setSyncMessage(count > 0 ? `${count} new email${count === 1 ? "" : "s"} synced.` : "Up to date.");
      } catch {
        setSyncMessage("Sync failed. Try again.");
      }
    });
  }

  const contactFirstName = personName?.split(" ")[0];

  const defaultOpportunityIds = defaultOpportunityId ? [defaultOpportunityId] : undefined;

  function openCompose() {
    setDraft({
      personId,
      to: personEmail ? [personEmail] : [],
      contactFirstName,
      opportunityIds: defaultOpportunityIds,
    });
  }

  function openReply(email: EmailWithOpens) {
    setDraft({
      personId,
      to: [email.direction === "sent" ? email.to[0] : email.from].filter(Boolean),
      subject: email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`,
      replyToEmailId: email.id,
      mailboxAccountId: email.mailboxAccountId ?? undefined,
      contactFirstName,
      opportunityIds: defaultOpportunityIds,
    });
  }

  function toggleExpanded(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <p className="text-[13px] text-subtle">
            {emails.length} email{emails.length === 1 ? "" : "s"}
          </p>
          {syncMessage && <span className="text-[12px] text-subtle">· {syncMessage}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={isSyncing}
            title="Check for new replies now"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[13px] hover:bg-muted transition-colors disabled:opacity-40"
          >
            <RefreshCw size={14} strokeWidth={1.75} className={isSyncing ? "animate-spin" : ""} />
            Sync now
          </button>
          <button
            onClick={openCompose}
            disabled={!personEmail}
            title={personEmail ? undefined : "This contact has no email address"}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[13px] hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={14} strokeWidth={1.75} />
            Compose
          </button>
        </div>
      </div>

      {emails.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-subtle">
          <Inbox size={28} strokeWidth={1.5} />
          <p className="text-[13px] mt-2">No emails yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {emails.map((email) => {
            const expanded = expandedId === email.id;
            return (
              <div key={email.id} className="border border-border rounded-md">
                <button
                  onClick={() => toggleExpanded(email.id)}
                  className="w-full flex items-start justify-between gap-3 p-3 text-left"
                >
                  <div className="min-w-0 flex items-start gap-2">
                    <ChevronDown
                      size={14}
                      strokeWidth={1.75}
                      className={`text-subtle shrink-0 mt-0.5 transition-transform ${expanded ? "" : "-rotate-90"}`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${
                            email.direction === "sent"
                              ? "bg-blue-500 text-white"
                              : "bg-emerald-500 text-white"
                          }`}
                        >
                          {email.direction === "sent" ? "Sent" : "Received"}
                        </span>
                        {email.campaignMember?.campaign && (
                          <span
                            className="text-[11px] px-1.5 py-0.5 rounded font-medium bg-violet-500 text-white"
                            title={`Sent from campaign: ${email.campaignMember.campaign.name}`}
                          >
                            Marketing
                          </span>
                        )}
                        <span className="text-[13px] font-medium truncate">{email.subject}</span>
                      </div>
                      <p className="text-[12px] text-subtle mt-1 truncate">
                        From: {email.from} · To: {email.to.join(", ")}
                      </p>
                      {context === "opportunity" ? (
                        <div className="mt-1.5">
                          <Link
                            href={contactHref(personId)}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted text-[11px] text-subtle hover:text-foreground hover:bg-muted/70 transition-colors"
                            title={`Go to ${personName ?? "contact"}`}
                          >
                            <UserIcon size={11} strokeWidth={1.75} />
                            {personName ?? "Contact"}
                          </Link>
                        </div>
                      ) : (
                        email.opportunities.length > 0 && (
                          <div className="mt-1.5">
                            <AssociatedDeals opportunities={email.opportunities.map((o) => o.opportunity)} />
                          </div>
                        )
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {email.direction === "sent" && email.opens.length > 0 && (
                      <span
                        className="flex items-center gap-1 text-[11px] text-emerald-400"
                        title={`Opened ${email.opens.length} time${email.opens.length === 1 ? "" : "s"}`}
                      >
                        <Eye size={12} strokeWidth={1.75} />
                        {email.opens.length}
                      </span>
                    )}
                    <span className="text-[11px] text-subtle">{formatDate(email.sentAt)}</span>
                  </div>
                </button>

                {expanded && (
                  <div className="px-3 pb-3">
                    {email.bcc.length > 0 && (
                      <p className="text-[12px] text-subtle mb-2">Bcc: {email.bcc.join(", ")}</p>
                    )}
                    <div
                      className="text-[13px] [&_*]:text-[13px]"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(email.bodyHtml) }}
                    />

                    {email.direction === "sent" && (
                      <div className="mt-3 pt-3 border-t border-border">
                        {email.opens.length === 0 ? (
                          <p className="text-[12px] text-subtle">Not opened yet.</p>
                        ) : (
                          <>
                            <p className="text-[12px] font-medium text-emerald-400 flex items-center gap-1.5">
                              <Eye size={13} strokeWidth={1.75} />
                              Opened {email.opens.length} time{email.opens.length === 1 ? "" : "s"}
                            </p>
                            <ul className="mt-1.5 space-y-0.5">
                              {email.opens.map((open) => (
                                <li key={open.id} className="text-[12px] text-subtle">
                                  {formatDate(open.openedAt)}
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => openReply(email)}
                      className="flex items-center gap-1.5 mt-3 text-[12px] text-subtle hover:text-foreground transition-colors"
                    >
                      <Reply size={13} strokeWidth={1.75} />
                      Reply
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {draft && (
        <EmailComposer draft={draft} opportunities={opportunities} mailboxes={mailboxes} onClose={() => setDraft(null)} />
      )}
    </div>
  );
}
