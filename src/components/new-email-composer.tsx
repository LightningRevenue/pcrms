"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { Minus, X, ChevronDown, Send, Search, UserX } from "lucide-react";
import { RichTextEditor } from "@/components/rich-text-editor";
import { searchContactsForCompose } from "@/lib/actions/inbox";
import { sendViaSmtp } from "@/lib/actions/mailbox-accounts";
import { sendEmail, listTemplates } from "@/lib/actions/emails";

type Contact = { id: string; name: string; email: string; unsubscribed?: boolean };
type MailboxOption = { id: string; label: string; email: string };
type Template = { id: string; name: string; subject: string; bodyHtml: string };

export function NewEmailComposer({
  mailboxes,
  onClose,
  onSent,
}: {
  mailboxes: MailboxOption[];
  onClose: () => void;
  onSent?: () => void;
}) {
  const { data: session } = useSession();
  const gmailEmail = session?.user?.email ?? null;

  const [minimized, setMinimized] = useState(false);
  const [fromId, setFromId] = useState<string>("gmail");
  const [showFromPicker, setShowFromPicker] = useState(false);

  const [recipients, setRecipients] = useState<Contact[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Contact[]>([]);
  const [showResults, setShowResults] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [bodyKey, setBodyKey] = useState(0);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    listTemplates().then(setTemplates).catch(() => {});
  }, []);

  function applyTemplate(t: Template) {
    setSubject(t.subject);
    setBody(t.bodyHtml);
    setBodyKey((k) => k + 1);
    setShowTemplates(false);
  }

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      searchContactsForCompose(q).then((people) =>
        setResults(people.filter((p) => !recipients.some((r) => r.id === p.id)))
      );
    }, 150);
    return () => clearTimeout(handle);
  }, [query, recipients]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowResults(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function addRecipient(contact: Contact) {
    setRecipients((prev) => [...prev, contact]);
    setQuery("");
    setResults([]);
  }

  function removeRecipient(id: string) {
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  }

  const unsubscribedRecipients = recipients.filter((r) => r.unsubscribed);

  function handleSend() {
    setError(null);
    if (recipients.length === 0) {
      setError("Add at least one recipient");
      return;
    }
    if (unsubscribedRecipients.length > 0) {
      setError("Remove unsubscribed contacts before sending — they can no longer be emailed.");
      return;
    }
    if (!subject.trim()) {
      setError("Add a subject");
      return;
    }

    startTransition(async () => {
      try {
        if (fromId === "gmail") {
          await Promise.all(
            recipients.map((r) =>
              sendEmail({ personId: r.id, to: [r.email], subject, bodyHtml: body })
            )
          );
        } else {
          await Promise.all(
            recipients.map((r) =>
              sendViaSmtp({ mailboxAccountId: fromId, personId: r.id, to: [r.email], subject, bodyHtml: body })
            )
          );
        }
        onSent?.();
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
        <span className="text-[13px] font-medium truncate">{subject.trim() ? subject : "New message"}</span>
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

          <div className="px-4 py-2.5 border-b border-border relative" ref={pickerRef}>
            <div className="flex items-start gap-2">
              <span className="text-[12px] text-subtle w-9 shrink-0 pt-1">To</span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  {recipients.map((r) => (
                    <span
                      key={r.id}
                      title={r.unsubscribed ? "This contact has unsubscribed and can't be emailed" : undefined}
                      className={`inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[12.5px] ${
                        r.unsubscribed ? "bg-red-500/10 text-red-400" : "bg-muted"
                      }`}
                    >
                      {r.unsubscribed && <UserX size={11} strokeWidth={1.75} />}
                      {r.name || r.email}
                      <button
                        onClick={() => removeRecipient(r.id)}
                        className="p-0.5 rounded-full text-subtle hover:text-foreground transition-colors"
                      >
                        <X size={11} strokeWidth={2} />
                      </button>
                    </span>
                  ))}
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setShowResults(true)}
                    placeholder={recipients.length === 0 ? "Search contacts by name or email..." : "Add another..."}
                    className="flex-1 min-w-[140px] text-[13px] outline-none bg-transparent py-0.5"
                  />
                </div>
              </div>
            </div>

            {showResults && query.trim() && (
              <div className="absolute left-4 right-4 top-full mt-1 bg-background border border-border rounded-md shadow-lg z-10 max-h-56 overflow-y-auto">
                {results.length === 0 ? (
                  <p className="px-3 py-2 text-[12px] text-subtle flex items-center gap-1.5">
                    <Search size={12} strokeWidth={1.75} />
                    No contacts found
                  </p>
                ) : (
                  results.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => addRecipient(c)}
                      className="w-full text-left px-3 py-2 text-[13px] hover:bg-muted transition-colors"
                    >
                      <div className="font-medium flex items-center gap-1.5">
                        {c.name || "Unnamed"}
                        {c.unsubscribed && (
                          <span className="flex items-center gap-1 text-[11px] text-red-400 font-normal">
                            <UserX size={11} strokeWidth={1.75} />
                            Unsubscribed
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] text-subtle">{c.email}</div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

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

          <div className="flex-1 min-h-0 flex flex-col px-4 py-3">
            <RichTextEditor key={bodyKey} value={body} onChange={setBody} placeholder="Write your message..." className="flex-1" />
          </div>

          {error && <p className="px-4 pb-2 text-[12px] text-red-400">{error}</p>}

          <div className="px-4 py-3 border-t border-border flex items-center justify-between shrink-0">
            <button
              onClick={handleSend}
              disabled={isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Send size={13} strokeWidth={2} />
              {isPending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
