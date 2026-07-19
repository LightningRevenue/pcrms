"use client";

import { useEffect, useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import type { Opportunity } from "@prisma/client";
import { Minus, X, ChevronDown, Paperclip, Send } from "lucide-react";
import { RichTextEditor } from "@/components/rich-text-editor";
import { OpportunityMultiSelect } from "@/components/opportunity-multi-select";
import { sendEmail, listTemplates } from "@/lib/actions/emails";
import { sendViaSmtp } from "@/lib/actions/mailbox-accounts";
import { createTask } from "@/lib/actions/tasks";
import { listTemplateVariables, type TemplateVariable } from "@/lib/template-variables";

export type ComposerDraft = {
  personId: string;
  to: string[];
  cc?: string[];
  subject?: string;
  bodyHtml?: string;
  replyToEmailId?: string;
  opportunityIds?: string[];
  // Preselects the From mailbox when this reply/compose is tied to a specific outreach
  // inbox (e.g. replying to a message that arrived via SMTP) — still overridable by the user.
  mailboxAccountId?: string;
  // Used for the "Follow-up with {name}" task title when scheduling a follow-up on send.
  contactFirstName?: string;
};

const DEFAULT_FOLLOW_UP_DAYS = 3;

export type MailboxOption = { id: string; label: string; email: string };

type Template = { id: string; name: string; subject: string; bodyHtml: string };

export function EmailComposer({
  draft,
  opportunities = [],
  mailboxes = [],
  onClose,
}: {
  draft: ComposerDraft;
  opportunities?: Opportunity[];
  mailboxes?: MailboxOption[];
  onClose: () => void;
}) {
  const { data: session } = useSession();
  const gmailEmail = session?.user?.email ?? null;

  const [minimized, setMinimized] = useState(false);
  const [fromId, setFromId] = useState<string>(draft.mailboxAccountId ?? "gmail");
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [to, setTo] = useState(draft.to.join(", "));
  const [cc, setCc] = useState((draft.cc ?? []).join(", "));
  const [bcc, setBcc] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(!!draft.cc?.length);
  const [subject, setSubject] = useState(draft.subject ?? "");
  const [body, setBody] = useState(draft.bodyHtml ?? "");
  const [bodyKey, setBodyKey] = useState(0);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [opportunityIds, setOpportunityIds] = useState<string[]>(draft.opportunityIds ?? []);
  const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
  const [followUpDays, setFollowUpDays] = useState(DEFAULT_FOLLOW_UP_DAYS);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    listTemplates().then(setTemplates).catch(() => {});
    listTemplateVariables().then(setVariables).catch(() => {});
  }, []);

  function applyTemplate(t: Template) {
    setSubject(t.subject);
    setBody(t.bodyHtml);
    setBodyKey((k) => k + 1);
    setShowTemplates(false);
  }

  function parseAddresses(input: string) {
    return input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function handleSend() {
    setError(null);
    const toList = parseAddresses(to);
    if (toList.length === 0) {
      setError("Add at least one recipient");
      return;
    }
    if (!subject.trim()) {
      setError("Add a subject");
      return;
    }

    startTransition(async () => {
      try {
        if (fromId === "gmail") {
          await sendEmail({
            personId: draft.personId,
            to: toList,
            cc: parseAddresses(cc),
            bcc: parseAddresses(bcc),
            subject,
            bodyHtml: body,
            replyToEmailId: draft.replyToEmailId,
            opportunityIds,
          });
        } else {
          await sendViaSmtp({
            mailboxAccountId: fromId,
            personId: draft.personId,
            to: toList,
            subject,
            bodyHtml: body,
            replyToEmailId: draft.replyToEmailId,
            opportunityIds,
          });
        }

        if (scheduleFollowUp) {
          const due = new Date();
          due.setDate(due.getDate() + followUpDays);
          await createTask({
            personId: draft.personId,
            title: `Follow-up with ${draft.contactFirstName || "contact"}`,
            type: "email",
            priority: "medium",
            due: due.toISOString(),
            opportunityIds,
          });
        }

        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to send email");
      }
    });
  }

  const selectedMailbox = mailboxes.find((m) => m.id === fromId);

  return (
    <div
      className={`fixed bottom-0 right-6 z-50 w-[620px] bg-background border border-border border-b-0 rounded-t-lg shadow-2xl flex flex-col ${
        minimized ? "" : "h-[600px]"
      }`}
    >
      <div
        className="h-11 shrink-0 flex items-center justify-between px-4 bg-muted rounded-t-lg cursor-pointer"
        onClick={() => setMinimized((m) => !m)}
      >
        <span className="text-[13px] font-medium truncate">
          {subject.trim() ? subject : "New message"}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMinimized((m) => !m);
            }}
            className="p-1.5 rounded text-subtle hover:bg-background hover:text-foreground transition-colors"
          >
            <Minus size={14} strokeWidth={2} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1.5 rounded text-subtle hover:bg-background hover:text-foreground transition-colors"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      {!minimized && (
        <div className="flex-1 min-h-0 flex flex-col">
          {mailboxes.length > 0 && (
            <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 relative">
              <span className="text-[12px] text-subtle w-9 shrink-0">From</span>
              <button
                onClick={() => setShowFromPicker((s) => !s)}
                className="flex-1 flex items-center gap-1.5 text-[13px] text-left truncate"
              >
                {fromId === "gmail" ? (
                  <>
                    <span className="font-medium">Gmail</span>
                    <span className="text-subtle truncate">&lt;{gmailEmail ?? "connected account"}&gt;</span>
                  </>
                ) : selectedMailbox ? (
                  <>
                    <span className="font-medium">{selectedMailbox.label}</span>
                    <span className="text-subtle truncate">&lt;{selectedMailbox.email}&gt;</span>
                  </>
                ) : (
                  <span className="text-subtle">Choose a sender</span>
                )}
                <ChevronDown size={13} strokeWidth={1.75} className="text-subtle shrink-0" />
              </button>
              {showFromPicker && (
                <div className="absolute left-4 right-4 top-full mt-1 bg-background border border-border rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                  <button
                    onClick={() => {
                      setFromId("gmail");
                      setShowFromPicker(false);
                    }}
                    className="w-full text-left px-3 py-2 text-[13px] hover:bg-muted transition-colors"
                  >
                    <div className="font-medium">Gmail</div>
                    <div className="text-[12px] text-subtle">{gmailEmail ?? "connected account"}</div>
                  </button>
                  {mailboxes.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setFromId(m.id);
                        setShowFromPicker(false);
                      }}
                      className="w-full text-left px-3 py-2 text-[13px] hover:bg-muted transition-colors"
                    >
                      <div className="font-medium">{m.label}</div>
                      <div className="text-[12px] text-subtle">{m.email}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
            <span className="text-[12px] text-subtle w-9 shrink-0">To</span>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="flex-1 text-[13px] outline-none bg-transparent"
              placeholder="recipient@example.com"
            />
            {!showCcBcc && (
              <button
                onClick={() => setShowCcBcc(true)}
                className="text-[12px] text-subtle hover:text-foreground transition-colors shrink-0"
              >
                Cc/Bcc
              </button>
            )}
          </div>

          {showCcBcc && (
            <>
              <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
                <span className="text-[12px] text-subtle w-9 shrink-0">Cc</span>
                <input
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  className="flex-1 text-[13px] outline-none bg-transparent"
                />
              </div>
              <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
                <span className="text-[12px] text-subtle w-9 shrink-0">Bcc</span>
                <input
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  className="flex-1 text-[13px] outline-none bg-transparent"
                />
              </div>
            </>
          )}

          <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="flex-1 text-[13px] outline-none bg-transparent"
            />
            <div className="relative shrink-0">
              <button
                onClick={() => setShowTemplates((s) => !s)}
                className="flex items-center gap-1 text-[12px] text-subtle hover:text-foreground transition-colors"
              >
                Templates
                <ChevronDown size={12} strokeWidth={1.75} />
              </button>
              {showTemplates && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-background border border-border rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                  {templates.length === 0 ? (
                    <p className="px-3 py-2 text-[12px] text-subtle">No templates yet.</p>
                  ) : (
                    templates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => applyTemplate(t)}
                        className="w-full text-left px-3 py-2 text-[13px] hover:bg-muted transition-colors"
                      >
                        {t.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {opportunities.length > 0 && (
            <div className="px-4 py-2.5 border-b border-border">
              <OpportunityMultiSelect
                opportunities={opportunities}
                selectedIds={opportunityIds}
                onChange={setOpportunityIds}
              />
            </div>
          )}

          <div className="flex-1 min-h-0 flex flex-col px-4 py-3">
            <RichTextEditor key={bodyKey} value={body} onChange={setBody} placeholder="Write your message..." className="flex-1" variables={variables} />
          </div>

          {error && <p className="px-4 pb-2 text-[12px] text-red-400">{error}</p>}

          <div className="px-4 pt-3 border-t border-border shrink-0">
            <label className="flex items-center gap-2 text-[12.5px] text-subtle cursor-pointer select-none">
              <input
                type="checkbox"
                checked={scheduleFollowUp}
                onChange={(e) => setScheduleFollowUp(e.target.checked)}
                className="accent-accent"
              />
              Schedule follow-up in
              <input
                type="number"
                min={1}
                value={followUpDays}
                onChange={(e) => setFollowUpDays(Math.max(1, Number(e.target.value) || 1))}
                disabled={!scheduleFollowUp}
                onClick={(e) => e.stopPropagation()}
                className="w-10 px-1 py-0.5 text-center rounded border border-border bg-transparent text-foreground outline-none focus:border-accent disabled:opacity-40"
              />
              day{followUpDays === 1 ? "" : "s"}
            </label>
          </div>

          <div className="px-4 py-3 flex items-center justify-between shrink-0">
            <button
              onClick={handleSend}
              disabled={isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Send size={13} strokeWidth={2} />
              {isPending ? "Sending…" : "Send"}
            </button>
            <button
              disabled
              title="Attachments not supported yet"
              className="p-1.5 rounded-md text-subtle opacity-40 cursor-not-allowed"
            >
              <Paperclip size={15} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
