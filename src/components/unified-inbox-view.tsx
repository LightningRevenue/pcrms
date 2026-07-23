"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Inbox as InboxIcon, Send, Reply, Plus, UserCheck, RefreshCw, User as UserIcon, Building2, Filter, Check, X, Megaphone, Eye } from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import type { InboxThread } from "@/lib/actions/inbox";
import { syncInboxNow } from "@/lib/actions/inbox";
import { EmailComposer, type ComposerDraft } from "@/components/email-composer";
import { NewEmailComposer } from "@/components/new-email-composer";
import { useContactHref } from "@/lib/view-mode";

type MailboxOption = { id: string; label: string; email: string };
type Tab = "received" | "crm" | "sent";
type InboxMessage = InboxThread["messages"][number];

const AVATAR_COLORS = [
  "bg-rose-500 text-white",
  "bg-blue-500 text-white",
  "bg-emerald-500 text-white",
  "bg-amber-500 text-white",
  "bg-violet-500 text-white",
  "bg-cyan-500 text-white",
];

function avatarColor(name: string) {
  const seed = name || "?";
  const code = seed.charCodeAt(0) + seed.charCodeAt(seed.length - 1);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function personName(person: { firstName: string; lastName: string | null } | null) {
  if (!person) return "";
  return [person.firstName, person.lastName].filter(Boolean).join(" ");
}

function formatListTime(date: Date) {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(date);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  const daysAgo = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (daysAgo < 7) return new Intl.DateTimeFormat("en", { weekday: "short" }).format(date);

  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function formatFullTime(date: Date) {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const time = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(date);
  if (isToday) return `Today, ${time}`;
  return `${new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(date)}, ${time}`;
}

export function UnifiedInboxView({
  threads,
  mailboxes,
  allMailboxes,
}: {
  threads: InboxThread[];
  mailboxes: MailboxOption[];
  allMailboxes: MailboxOption[];
}) {
  const router = useRouter();
  const contactHref = useContactHref();
  const [tab, setTab] = useState<Tab>("received");
  const [query, setQuery] = useState("");
  const [mailboxFilter, setMailboxFilter] = useState<Set<string>>(new Set());
  const [marketingOnly, setMarketingOnly] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(threads[0]?.threadId ?? null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ComposerDraft | null>(null);
  const [composingNew, setComposingNew] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isSyncing, startSync] = useTransition();

  // The IMAP poll worker pushes an "email_reply" notification the moment it saves a new
  // message (same Redis pub/sub channel the notification bell listens on) — refresh the
  // thread list live instead of making the user hit Sync now to see it.
  useEffect(() => {
    const source = new EventSource("/api/notifications/stream");
    source.onmessage = (event) => {
      if (event.data.startsWith(":")) return;
      try {
        const notification = JSON.parse(event.data) as { kind?: string };
        if (notification.kind === "email_reply") router.refresh();
      } catch {}
    };
    return () => source.close();
  }, [router]);

  function handleSync() {
    setSyncMessage(null);
    startSync(async () => {
      try {
        const found = await syncInboxNow();
        setSyncMessage(found > 0 ? `${found} new email${found === 1 ? "" : "s"} synced.` : "Up to date.");
        router.refresh();
      } catch {
        setSyncMessage("Sync failed. Try again.");
      }
    });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return threads.filter((t) => {
      const last = t.messages[t.messages.length - 1];
      // A thread with messages in both directions belongs in every tab its messages qualify
      // for — it's a matter of "does this conversation have a message like that", not "what
      // was the last message" (otherwise a thread you started would vanish from Sent the
      // moment someone replied to it).
      if (tab === "sent") {
        if (!t.messages.some((m) => m.direction === "sent")) return false;
      } else if (tab === "crm") {
        if (!t.messages.some((m) => m.direction === "received" && m.person !== null)) return false;
      } else {
        if (!t.messages.some((m) => m.direction === "received")) return false;
      }
      if (mailboxFilter.size > 0) {
        const involved = t.messages.some((m) => m.mailboxAccountId && mailboxFilter.has(m.mailboxAccountId));
        if (!involved) return false;
      }
      if (marketingOnly) {
        if (!t.messages.some((m) => m.campaignMember?.campaign)) return false;
      }
      if (!q) return true;
      const name = personName(last.person);
      return (
        last.subject.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q) ||
        (last.person?.email ?? last.from).toLowerCase().includes(q)
      );
    });
  }, [threads, tab, query, mailboxFilter, marketingOnly]);

  const selected = threads.find((t) => t.threadId === selectedThreadId) ?? filtered[0] ?? null;
  const lastMessage = selected?.messages[selected.messages.length - 1];

  function selectThread(threadId: string) {
    setSelectedThreadId(threadId);
    const thread = threads.find((t) => t.threadId === threadId);
    setExpandedId(thread ? thread.messages[thread.messages.length - 1].id : null);
  }

  function openReply(message: InboxMessage) {
    if (!message.personId) return;
    const to = message.direction === "sent" ? message.to[0] : message.from;
    const subject = message.subject.startsWith("Re:") ? message.subject : `Re: ${message.subject}`;

    setDraft({
      personId: message.personId,
      to: [to].filter(Boolean),
      subject,
      replyToEmailId: message.id,
      mailboxAccountId: message.mailboxAccountId ?? undefined,
      contactFirstName: message.person?.firstName,
    });
  }

  const tabs: { key: Tab; label: string; icon: typeof InboxIcon }[] = [
    { key: "received", label: "Received", icon: InboxIcon },
    { key: "crm", label: "CRM Related", icon: UserCheck },
    { key: "sent", label: "Sent", icon: Send },
  ];

  return (
    <div className="flex flex-col h-screen">
      <div className="h-12 shrink-0 border-b border-border flex items-center px-4 gap-3">
        <h1 className="text-[13px] font-semibold">Unified Inbox</h1>
        <span className="text-[12px] text-subtle">
          {threads.length} conversation{threads.length === 1 ? "" : "s"}
        </span>
        {syncMessage && <span className="text-[12px] text-subtle">· {syncMessage}</span>}
        <div className="flex-1" />
        <button
          onClick={handleSync}
          disabled={isSyncing}
          title="Check all connected mailboxes for new messages now"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[13px] hover:bg-muted transition-colors disabled:opacity-40"
        >
          <RefreshCw size={14} strokeWidth={1.75} className={isSyncing ? "animate-spin" : ""} />
          Sync now
        </button>
        <button
          onClick={() => setComposingNew(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={14} strokeWidth={2} />
          New email
        </button>
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* Left: thread list */}
        <div className="w-[380px] shrink-0 border-r border-border flex flex-col min-h-0">
          <div className="flex gap-0.5 px-2.5 pt-2.5">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12.5px] font-medium border transition-colors ${
                  tab === key
                    ? "bg-muted text-foreground border-border"
                    : "text-subtle border-transparent hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon size={13} strokeWidth={1.75} />
                {label}
              </button>
            ))}
          </div>

          <div className="px-2.5 pt-2.5 pb-1.5 flex items-center gap-1.5">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations..."
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md border border-border bg-surface text-[12.5px] outline-none focus:border-accent transition-colors"
            />
            <MailboxFilterPicker mailboxes={allMailboxes} selected={mailboxFilter} onChange={setMailboxFilter} />
            <button
              onClick={() => setMarketingOnly((v) => !v)}
              title="Only show conversations sent or received via a marketing campaign"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[12.5px] transition-colors shrink-0 ${
                marketingOnly
                  ? "border-violet-500 text-violet-400 bg-violet-500/10"
                  : "border-border text-subtle hover:text-foreground hover:bg-muted"
              }`}
            >
              <Megaphone size={13} strokeWidth={1.75} />
              Marketing
            </button>
          </div>
          {(mailboxFilter.size > 0 || marketingOnly) && (
            <div className="px-2.5 pb-1.5 flex flex-wrap gap-1">
              {allMailboxes
                .filter((m) => mailboxFilter.has(m.id))
                .map((m) => (
                  <button
                    key={m.id}
                    onClick={() =>
                      setMailboxFilter((prev) => {
                        const next = new Set(prev);
                        next.delete(m.id);
                        return next;
                      })
                    }
                    className="flex items-center gap-1 pl-2 pr-1.5 py-0.5 rounded-full bg-accent/10 text-accent text-[11px] hover:bg-accent/20 transition-colors"
                  >
                    {m.label || m.email}
                    <X size={11} strokeWidth={2} />
                  </button>
                ))}
              {marketingOnly && (
                <button
                  onClick={() => setMarketingOnly(false)}
                  className="flex items-center gap-1 pl-2 pr-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 text-[11px] hover:bg-violet-500/20 transition-colors"
                >
                  Marketing
                  <X size={11} strokeWidth={2} />
                </button>
              )}
              <button
                onClick={() => {
                  setMailboxFilter(new Set());
                  setMarketingOnly(false);
                }}
                className="text-[11px] text-subtle hover:text-foreground transition-colors px-1"
              >
                Clear all
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-1.5 pb-3">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-subtle">
                <InboxIcon size={26} strokeWidth={1.5} />
                <p className="text-[13px] mt-2">No conversations here.</p>
              </div>
            ) : (
              filtered.map((thread) => {
                const last = thread.messages[thread.messages.length - 1];
                const name = personName(last.person) || last.from;
                const active = selected?.threadId === thread.threadId;
                const lastSent = [...thread.messages].reverse().find((m) => m.direction === "sent");
                return (
                  <button
                    key={thread.threadId}
                    onClick={() => selectThread(thread.threadId)}
                    className={`w-full flex gap-2.5 p-2 rounded-lg text-left border transition-colors ${
                      active ? "bg-muted border-border" : "border-transparent hover:bg-muted"
                    }`}
                  >
                    <div
                      className={`size-[30px] shrink-0 rounded-full flex items-center justify-center text-[11.5px] font-semibold ${avatarColor(name)}`}
                    >
                      {initials(name) || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[13px] font-semibold truncate">{name || "Unknown"}</span>
                        {thread.messages.some((m) => m.campaignMember?.campaign) && (
                          <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-500 text-white">
                            Marketing
                          </span>
                        )}
                        <span className="ml-auto text-[11px] text-subtle shrink-0">{formatListTime(last.sentAt)}</span>
                      </div>
                      <p className="text-[12.5px] truncate mt-0.5">{last.subject}</p>
                      <p className="text-[12px] text-subtle truncate mt-0.5">
                        {last.bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 90)}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {thread.messages.length > 1 && (
                          <span className="text-[10.5px] px-1.5 py-0.5 rounded-full bg-surface border border-border text-subtle">
                            {thread.messages.length} messages
                          </span>
                        )}
                        {lastSent && lastSent.opens.length > 0 && (
                          <span
                            className="flex items-center gap-1 text-[10.5px] text-emerald-400"
                            title={`Opened ${lastSent.opens.length} time${lastSent.opens.length === 1 ? "" : "s"}`}
                          >
                            <Eye size={11} strokeWidth={1.75} />
                            {lastSent.opens.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: reading pane */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          {!selected || !lastMessage ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-subtle">
              <InboxIcon size={28} strokeWidth={1.5} className="opacity-50" />
              <span className="text-[13px]">Select a conversation to read</span>
            </div>
          ) : (
            <>
              <div className="shrink-0 px-10 pt-5 pb-4 border-b border-border">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-[18px] font-semibold text-balance">{lastMessage.subject}</h2>
                    <p className="text-[12px] text-subtle mt-1">
                      {selected.messages.length} message{selected.messages.length === 1 ? "" : "s"} · with{" "}
                      {personName(lastMessage.person) || lastMessage.from}
                    </p>
                  </div>
                  {lastMessage.person && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Link
                        href={contactHref(lastMessage.person.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[12.5px] text-subtle hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <UserIcon size={13} strokeWidth={1.75} />
                        Go to contact
                      </Link>
                      {lastMessage.person.companyId && (
                        <Link
                          href={`/companies/${lastMessage.person.companyId}`}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[12.5px] text-subtle hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <Building2 size={13} strokeWidth={1.75} />
                          Go to company
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-10 py-5 flex flex-col gap-2">
                {selected.messages.map((message) => {
                  const expanded = expandedId === message.id;
                  const name = personName(message.person);
                  const fromLabel = message.direction === "sent" ? "You" : name || message.from;
                  return (
                    <div key={message.id} className="border border-border rounded-[10px] bg-surface">
                      <button
                        onClick={() => setExpandedId((cur) => (cur === message.id ? null : message.id))}
                        className={`w-full flex items-center gap-2.5 px-4 py-3 text-left ${
                          expanded ? "border-b border-border" : ""
                        }`}
                      >
                        <div
                          className={`size-[30px] shrink-0 rounded-full flex items-center justify-center text-[12px] font-semibold ${avatarColor(fromLabel)}`}
                        >
                          {initials(fromLabel) || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-[13px] font-semibold whitespace-nowrap">{fromLabel}</span>
                            <span
                              className={`shrink-0 text-[10.5px] font-medium px-1.5 py-0.5 rounded-full ${
                                message.direction === "sent"
                                  ? "bg-blue-500 text-white"
                                  : "bg-emerald-500 text-white"
                              }`}
                            >
                              {message.direction === "sent" ? "📤 Sent" : "📥 Received"}
                            </span>
                            {message.campaignMember?.campaign && (
                              <span
                                className="shrink-0 text-[10.5px] font-medium px-1.5 py-0.5 rounded-full bg-violet-500 text-white"
                                title={`Sent from campaign: ${message.campaignMember.campaign.name}`}
                              >
                                Marketing
                              </span>
                            )}
                            {message.direction === "sent" && message.opens.length > 0 && (
                              <span
                                className="shrink-0 flex items-center gap-1 text-[10.5px] text-emerald-400"
                                title={`Opened ${message.opens.length} time${message.opens.length === 1 ? "" : "s"}`}
                              >
                                <Eye size={11} strokeWidth={1.75} />
                                {message.opens.length}
                              </span>
                            )}
                            <span className="text-[12px] text-subtle truncate">
                              to {message.to.join(", ") || "—"}
                            </span>
                          </div>
                          {!expanded && (
                            <p className="text-[12.5px] text-subtle truncate mt-0.5">
                              {message.bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 100)}
                            </p>
                          )}
                        </div>
                        <span className="text-[12px] text-subtle shrink-0">{formatFullTime(message.sentAt)}</span>
                        <ChevronDown
                          size={14}
                          strokeWidth={1.75}
                          className={`text-subtle shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                        />
                      </button>

                      {expanded && (
                        <div className="px-4 pt-1 pb-5 pl-[4.5rem]">
                          <p className="text-[12px] text-subtle">
                            from <b className="text-foreground font-medium">{message.from}</b>
                          </p>
                          <p className="text-[12px] text-subtle mt-0.5">
                            to <b className="text-foreground font-medium">{message.to.join(", ")}</b>
                          </p>
                          {message.bcc.length > 0 && (
                            <p className="text-[12px] text-subtle mt-0.5">
                              bcc <b className="text-foreground font-medium">{message.bcc.join(", ")}</b>
                            </p>
                          )}
                          <div
                            className="text-[13.5px] leading-[1.7] max-w-[620px] [&_p]:mb-3.5 mt-3.5"
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(message.bodyHtml) }}
                          />
                          <button
                            onClick={() => openReply(message)}
                            disabled={!message.personId}
                            title={message.personId ? undefined : "This sender isn't linked to a CRM contact yet"}
                            className="flex items-center gap-1.5 mt-4 text-[12.5px] text-subtle hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Reply size={13} strokeWidth={1.75} />
                            Reply to this message
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="shrink-0 border-t border-border px-10 py-3.5 flex items-center gap-2.5">
                <button
                  onClick={() => lastMessage && openReply(lastMessage)}
                  disabled={!lastMessage?.personId}
                  title={lastMessage?.personId ? undefined : "This sender isn't linked to a CRM contact yet"}
                  className="flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-border bg-surface text-[13px] text-subtle hover:text-foreground hover:border-accent transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Reply size={14} strokeWidth={1.75} />
                  Reply to {personName(lastMessage?.person ?? null) || lastMessage?.from}...
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {draft && (
        <EmailComposer draft={draft} mailboxes={mailboxes} onClose={() => setDraft(null)} />
      )}
      {composingNew && (
        <NewEmailComposer
          mailboxes={mailboxes}
          onClose={() => setComposingNew(false)}
          onSent={() => router.refresh()}
        />
      )}
    </div>
  );
}

function MailboxFilterPicker({
  mailboxes,
  selected,
  onChange,
}: {
  mailboxes: MailboxOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Filter by outreach inbox"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[12.5px] transition-colors ${
          selected.size > 0
            ? "border-accent text-accent bg-accent/10"
            : "border-border text-subtle hover:text-foreground hover:bg-muted"
        }`}
      >
        <Filter size={13} strokeWidth={1.75} />
        {selected.size > 0 ? selected.size : ""}
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-72 border border-border rounded-lg bg-surface shadow-lg z-20 flex flex-col">
          <p className="px-3 pt-2 pb-1 text-[11px] font-medium text-subtle uppercase tracking-wide">
            Outreach inboxes
          </p>
          <div className="max-h-64 overflow-y-auto py-1">
            {mailboxes.length === 0 ? (
              <p className="px-3 py-2 text-[12px] text-subtle">
                No outreach inboxes connected. Add one in Settings → Outreach Inboxes.
              </p>
            ) : (
              mailboxes.map((m) => {
                const checked = selected.has(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => toggle(m.id)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[12.5px] hover:bg-muted transition-colors text-left"
                  >
                    <span className="min-w-0 truncate">
                      <span className="truncate">{m.label}</span>
                      <span className="text-subtle"> · {m.email}</span>
                    </span>
                    {checked && <Check size={13} strokeWidth={2} className="shrink-0 text-accent" />}
                  </button>
                );
              })
            )}
          </div>
          {selected.size > 0 && (
            <div className="border-t border-border p-1.5">
              <button
                onClick={() => onChange(new Set())}
                className="w-full text-center text-[12px] text-subtle hover:text-foreground transition-colors py-1"
              >
                Clear filter
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
