"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, Inbox as InboxIcon, Send, Reply, Plus, RefreshCw, User as UserIcon, Building2, Mail, X, Megaphone, Eye, Layers, PanelRight, UserCircle, Briefcase, Clock, MailOpen, CornerUpLeft, SlidersHorizontal, Check } from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import type { InboxThread } from "@/lib/actions/inbox";
import { syncInboxNow } from "@/lib/actions/inbox";
import { INBOX_PAGE_SIZE, type InboxFilters } from "@/lib/inbox-filters";
import { EmailComposer, type ComposerDraft } from "@/components/email-composer";
import { NewEmailComposer } from "@/components/new-email-composer";
import { FilterPicker } from "@/components/filter-picker";
import { InboxLeadPanel } from "@/components/inbox-lead-panel";
import { useContactHref } from "@/lib/view-mode";

type MailboxOption = { id: string; label: string; email: string };
type Tab = "received" | "sent" | "all";
type InboxMessage = InboxThread["messages"][number];
type FilterOptions = {
  owners: { id: string; name: string | null; email: string | null }[];
  companies: { id: string; name: string }[];
  campaigns: { id: string; name: string }[];
};

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
  total,
  filters,
  options,
  mailboxes,
  allMailboxes,
}: {
  threads: InboxThread[];
  total: number;
  filters: InboxFilters;
  options: FilterOptions;
  mailboxes: MailboxOption[];
  allMailboxes: MailboxOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const contactHref = useContactHref();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(threads[0]?.threadId ?? null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ComposerDraft | null>(null);
  const [composingNew, setComposingNew] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isSyncing, startSync] = useTransition();
  const [leadPanelOpen, setLeadPanelOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState(filters.q ?? "");

  const tab: Tab = filters.tab ?? "received";
  const page = filters.page ?? 1;
  const totalPages = Math.max(1, Math.ceil(total / INBOX_PAGE_SIZE));

  // Every filter is a URL param — one setter for all of them. Changing any filter resets
  // to page 1, otherwise you land on an out-of-range page with an empty list.
  function setParam(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    if (!("page" in updates)) next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  const setMulti = (key: string) => (next: Set<string>) =>
    setParam({ [key]: next.size ? Array.from(next).join(",") : null });

  // Debounce the search box so typing doesn't fire a navigation per keystroke.
  useEffect(() => {
    if (query === (filters.q ?? "")) return;
    const timer = setTimeout(() => setParam({ q: query || null }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

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

  const selected = threads.find((t) => t.threadId === selectedThreadId) ?? threads[0] ?? null;
  const lastMessage = selected?.messages[selected.messages.length - 1];
  // The contact behind this conversation — the panel needs a linked person, and the last
  // message may be an outbound one with the person on an earlier message.
  const leadPersonId = selected?.messages.reduce<string | null>((found, m) => found ?? m.personId, null) ?? null;

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
    { key: "sent", label: "Sent", icon: Send },
    { key: "all", label: "All", icon: Layers },
  ];

  // Active filters as removable chips — one flat list, so "what am I looking at" is
  // answerable at a glance regardless of which dropdown set it.
  const chips: { key: string; label: string; clear: () => void }[] = [
    ...(filters.ownerIds ?? []).map((id) => ({
      key: `owner-${id}`,
      label: `Owner: ${options.owners.find((o) => o.id === id)?.name ?? "Unknown"}`,
      clear: () => setParam({ owner: (filters.ownerIds ?? []).filter((x) => x !== id).join(",") || null }),
    })),
    ...(filters.companyIds ?? []).map((id) => ({
      key: `company-${id}`,
      label: `Company: ${options.companies.find((c) => c.id === id)?.name ?? "Unknown"}`,
      clear: () => setParam({ company: (filters.companyIds ?? []).filter((x) => x !== id).join(",") || null }),
    })),
    ...(filters.campaignIds ?? []).map((id) => ({
      key: `campaign-${id}`,
      label: `Campaign: ${options.campaigns.find((c) => c.id === id)?.name ?? "Unknown"}`,
      clear: () => setParam({ campaign: (filters.campaignIds ?? []).filter((x) => x !== id).join(",") || null }),
    })),
    ...(filters.mailboxIds ?? []).map((id) => ({
      key: `mailbox-${id}`,
      label: `Inbox: ${allMailboxes.find((m) => m.id === id)?.label ?? "Unknown"}`,
      clear: () => setParam({ mailbox: (filters.mailboxIds ?? []).filter((x) => x !== id).join(",") || null }),
    })),
    ...(filters.linked ? [{ key: "linked", label: filters.linked === "linked" ? "Has CRM contact" : "No CRM contact", clear: () => setParam({ linked: null }) }] : []),
    ...(filters.unanswered ? [{ key: "unanswered", label: "Awaiting reply", clear: () => setParam({ unanswered: null }) }] : []),
    ...(filters.opened ? [{ key: "opened", label: "Opened", clear: () => setParam({ opened: null }) }] : []),
    ...(filters.days ? [{ key: "days", label: `Last ${filters.days}d`, clear: () => setParam({ days: null }) }] : []),
  ];

  return (
    <div className="flex flex-col h-screen">
      <div className="h-12 shrink-0 border-b border-border flex items-center px-4 gap-3">
        <h1 className="text-[13px] font-semibold">Unified Inbox</h1>
        <span className="text-[12px] text-subtle">
          {total} conversation{total === 1 ? "" : "s"}
          {chips.length > 0 && " matching"}
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
                onClick={() => setParam({ tab: key === "received" ? null : key })}
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
            <button
              onClick={() => setFiltersOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[12.5px] transition-colors shrink-0 ${
                chips.length > 0
                  ? "border-accent text-accent bg-accent/10"
                  : "border-border text-subtle hover:text-foreground hover:bg-muted"
              }`}
            >
              <SlidersHorizontal size={13} strokeWidth={1.75} />
              Filters
              {chips.length > 0 && (
                <span className="px-1.5 rounded-full bg-accent/15 text-[11px]">{chips.length}</span>
              )}
            </button>
          </div>

          {chips.length > 0 && (
            <div className="px-2.5 pb-1.5 flex flex-wrap gap-1">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  onClick={chip.clear}
                  className="flex items-center gap-1 pl-2 pr-1.5 py-0.5 rounded-full bg-accent/10 text-accent text-[11px] hover:bg-accent/20 transition-colors max-w-[200px]"
                >
                  <span className="truncate">{chip.label}</span>
                  <X size={11} strokeWidth={2} className="shrink-0" />
                </button>
              ))}
              <button
                onClick={() => router.push(pathname)}
                className="text-[11px] text-subtle hover:text-foreground transition-colors px-1"
              >
                Clear all
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-1.5 pb-3">
            {threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-subtle">
                <InboxIcon size={26} strokeWidth={1.5} />
                <p className="text-[13px] mt-2">No conversations here.</p>
              </div>
            ) : (
              threads.map((thread) => {
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

          {totalPages > 1 && (
            <div className="shrink-0 border-t border-border px-2.5 py-2 flex items-center justify-between text-[12px] text-subtle">
              <button
                onClick={() => setParam({ page: String(page - 1) })}
                disabled={page <= 1}
                className="px-2 py-1 rounded-md hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
              >
                Previous
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setParam({ page: String(page + 1) })}
                disabled={page >= totalPages}
                className="px-2 py-1 rounded-md hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
              >
                Next
              </button>
            </div>
          )}
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
                  <div className="flex items-center gap-1.5 shrink-0">
                    {leadPersonId && (
                      <button
                        onClick={() => setLeadPanelOpen((v) => !v)}
                        title="Show deal, tasks and notes for this lead"
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[12.5px] transition-colors ${
                          leadPanelOpen
                            ? "border-accent text-accent bg-accent/10"
                            : "border-border text-subtle hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        <Briefcase size={13} strokeWidth={1.75} />
                        Lead
                        <PanelRight size={12} strokeWidth={1.75} className="opacity-60" />
                      </button>
                    )}
                    {lastMessage.person && (
                      <Link
                        href={contactHref(lastMessage.person.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[12.5px] text-subtle hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <UserIcon size={13} strokeWidth={1.75} />
                        Go to contact
                      </Link>
                    )}
                    {lastMessage.person?.companyId && (
                      <Link
                        href={`/companies/${lastMessage.person.companyId}`}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[12.5px] text-subtle hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Building2 size={13} strokeWidth={1.75} />
                        Go to company
                      </Link>
                    )}
                  </div>
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

        {leadPanelOpen && leadPersonId && (
          <InboxLeadPanel personId={leadPersonId} onClose={() => setLeadPanelOpen(false)} />
        )}
      </div>

      {filtersOpen && (
        <InboxFilterModal
          filters={filters}
          options={options}
          allMailboxes={allMailboxes}
          activeCount={chips.length}
          onClose={() => setFiltersOpen(false)}
          onSet={setParam}
          onSetMulti={setMulti}
          onClearAll={() => router.push(pathname)}
        />
      )}

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

function FieldLabel({ icon: Icon, children }: { icon: typeof Megaphone; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5 text-[11.5px] font-medium text-subtle uppercase tracking-wide">
      <Icon size={12} strokeWidth={1.75} />
      {children}
    </div>
  );
}

/** Boolean filter as a full-width row with a checkbox — reads as a form, not a toolbar. */
function CheckRow({
  active,
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  icon: typeof Megaphone;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg border text-left transition-colors ${
        active ? "border-accent bg-accent/5" : "border-border hover:bg-muted"
      }`}
    >
      <span
        className={`mt-0.5 size-[15px] shrink-0 rounded flex items-center justify-center border transition-colors ${
          active ? "bg-accent border-accent text-white" : "border-border"
        }`}
      >
        {active && <Check size={11} strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[12.5px]">
          <Icon size={13} strokeWidth={1.75} className="text-subtle" />
          {label}
        </span>
        <span className="block text-[11.5px] text-subtle mt-0.5">{hint}</span>
      </span>
    </button>
  );
}

function InboxFilterModal({
  filters,
  options,
  allMailboxes,
  activeCount,
  onClose,
  onSet,
  onSetMulti,
  onClearAll,
}: {
  filters: InboxFilters;
  options: FilterOptions;
  allMailboxes: MailboxOption[];
  activeCount: number;
  onClose: () => void;
  onSet: (updates: Record<string, string | null>) => void;
  onSetMulti: (key: string) => (next: Set<string>) => void;
  onClearAll: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const days = filters.days;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-[520px] max-h-[85vh] flex flex-col rounded-xl border border-border bg-surface shadow-2xl">
        <div className="shrink-0 flex items-center justify-between px-5 h-12 border-b border-border">
          <h2 className="text-[13px] font-semibold">Filter conversations</h2>
          <button onClick={onClose} className="text-subtle hover:text-foreground transition-colors">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel icon={UserCircle}>Owner</FieldLabel>
              <FilterPicker
                label="Any owner"
                icon={UserCircle}
                options={options.owners.map((o) => ({ id: o.id, label: o.name ?? o.email ?? "Unknown" }))}
                selected={new Set(filters.ownerIds ?? [])}
                onChange={onSetMulti("owner")}
                emptyText="No owners yet."
                full
              />
            </div>
            <div>
              <FieldLabel icon={Building2}>Company</FieldLabel>
              <FilterPicker
                label="Any company"
                icon={Building2}
                options={options.companies.map((c) => ({ id: c.id, label: c.name }))}
                selected={new Set(filters.companyIds ?? [])}
                onChange={onSetMulti("company")}
                emptyText="No companies yet."
                full
              />
            </div>
            <div>
              <FieldLabel icon={Megaphone}>Campaign</FieldLabel>
              <FilterPicker
                label="Any campaign"
                icon={Megaphone}
                options={options.campaigns.map((c) => ({ id: c.id, label: c.name }))}
                selected={new Set(filters.campaignIds ?? [])}
                onChange={onSetMulti("campaign")}
                emptyText="No campaigns yet."
                full
              />
            </div>
            <div>
              <FieldLabel icon={Mail}>Outreach inbox</FieldLabel>
              <FilterPicker
                label="Any inbox"
                icon={Mail}
                options={allMailboxes.map((m) => ({
                  id: m.id,
                  label: m.label || m.email,
                  hint: m.label ? m.email : undefined,
                }))}
                selected={new Set(filters.mailboxIds ?? [])}
                onChange={onSetMulti("mailbox")}
                emptyText="No outreach inboxes connected."
                full
              />
            </div>
          </div>

          <div>
            <FieldLabel icon={Clock}>Time range</FieldLabel>
            <div className="flex gap-1.5">
              {[
                { value: null, label: "All time" },
                { value: "7", label: "Last 7 days" },
                { value: "30", label: "Last 30 days" },
                { value: "90", label: "Last 90 days" },
              ].map((option) => {
                const active = (days ? String(days) : null) === option.value;
                return (
                  <button
                    key={option.label}
                    onClick={() => onSet({ days: option.value })}
                    className={`flex-1 py-1.5 rounded-lg border text-[12px] transition-colors ${
                      active
                        ? "border-accent text-accent bg-accent/10"
                        : "border-border text-subtle hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <FieldLabel icon={CornerUpLeft}>Status</FieldLabel>
            <div className="space-y-1.5">
              <CheckRow
                active={!!filters.unanswered}
                icon={CornerUpLeft}
                label="Awaiting reply"
                hint="You sent the last message in the thread"
                onClick={() => onSet({ unanswered: filters.unanswered ? null : "1" })}
              />
              <CheckRow
                active={!!filters.opened}
                icon={MailOpen}
                label="Opened"
                hint="Thread contains a tracked email open"
                onClick={() => onSet({ opened: filters.opened ? null : "1" })}
              />
              <CheckRow
                active={filters.linked === "linked"}
                icon={UserIcon}
                label="In CRM"
                hint="Sender is linked to a CRM contact"
                onClick={() => onSet({ linked: filters.linked === "linked" ? null : "linked" })}
              />
              <CheckRow
                active={filters.linked === "unlinked"}
                icon={UserIcon}
                label="Not in CRM"
                hint="Unrecognized senders — potential new leads"
                onClick={() => onSet({ linked: filters.linked === "unlinked" ? null : "unlinked" })}
              />
            </div>
          </div>
        </div>

        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-t border-border">
          <button
            onClick={onClearAll}
            disabled={activeCount === 0}
            className="text-[12.5px] text-subtle hover:text-foreground transition-colors disabled:opacity-40"
          >
            Clear all
          </button>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-md bg-accent text-white text-[12.5px] font-medium hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
