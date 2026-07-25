"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { InboxThread } from "@/lib/actions/inbox";
import { sendEmail } from "@/lib/actions/emails";

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function relativeTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString();
}

export function MobileInboxList({ threads }: { threads: InboxThread[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (threads.length === 0) {
    return <div className="p-4 text-[13px] text-subtle">No email activity yet.</div>;
  }

  return (
    <div className="divide-y divide-border">
      {threads.map((thread) => {
        const last = thread.messages[thread.messages.length - 1];
        const person = last.person;
        const name = person ? [person.firstName, person.lastName].filter(Boolean).join(" ") : last.from;
        const isOpen = openId === thread.threadId;

        return (
          <div key={thread.threadId}>
            <button
              onClick={() => setOpenId(isOpen ? null : thread.threadId)}
              className="w-full flex items-start gap-3 px-4 py-3 text-left active:bg-muted transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13.5px] font-semibold truncate">{name}</span>
                  <span className="text-[11px] text-subtle shrink-0">{relativeTime(last.sentAt)}</span>
                </div>
                <p className="text-[12.5px] text-subtle truncate">{last.subject}</p>
                <p className="text-[12.5px] text-subtle truncate">
                  {last.direction === "sent" ? "You: " : ""}
                  {stripHtml(last.bodyHtml)}
                </p>
              </div>
            </button>
            {isOpen && <ThreadDetail thread={thread} />}
          </div>
        );
      })}
    </div>
  );
}

function ThreadDetail({ thread }: { thread: InboxThread }) {
  const last = thread.messages[thread.messages.length - 1];
  const person = last.person;
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  function reply() {
    if (!body.trim() || !person?.email) return;
    startTransition(async () => {
      await sendEmail({
        personId: person.id,
        to: [person.email as string],
        subject: last.subject.startsWith("Re:") ? last.subject : `Re: ${last.subject}`,
        bodyHtml: `<p>${body.trim().replace(/\n/g, "<br/>")}</p>`,
        replyToEmailId: last.id,
      });
      setBody("");
      setSent(true);
    });
  }

  return (
    <div className="px-4 pb-4 space-y-3 bg-muted/40">
      <div className="rounded-lg border border-border bg-surface p-3 text-[13px] whitespace-pre-wrap">
        {stripHtml(last.bodyHtml)}
      </div>

      {person && (
        <Link href={`/m/contacts/${person.id}`} className="text-[12px] text-accent font-medium">
          View contact →
        </Link>
      )}

      {person?.email && (
        <div className="space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a reply..."
            rows={3}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] focus:outline-none focus:border-accent"
          />
          <button
            onClick={reply}
            disabled={!body.trim() || isPending}
            className="w-full rounded-lg bg-accent text-white text-[13px] font-semibold py-2 disabled:opacity-50"
          >
            {isPending ? "Sending..." : sent ? "Sent ✓" : "Send reply"}
          </button>
        </div>
      )}
    </div>
  );
}
