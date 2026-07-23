"use client";

import { useRef, useState } from "react";

type WorkspaceUser = { id: string; name: string | null; email: string | null };

// Textarea with a Slack/Notion-style @mention dropdown. Typing "@" opens a filtered list of
// workspace members; picking one inserts "@Full Name " (trailing space) at the cursor — that
// literal substring is what lib/note-mentions.ts's parseMentionedUserIds looks for at save
// time, so the two must stay in sync if this insertion format ever changes.
export function NoteMentionInput({
  value,
  onChange,
  users,
  placeholder,
  autoFocus,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  users: WorkspaceUser[];
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [highlighted, setHighlighted] = useState(0);

  const displayName = (u: WorkspaceUser) => u.name ?? u.email ?? "Unknown";
  const matches =
    mentionQuery === null
      ? []
      : users.filter((u) => displayName(u).toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    onChange(next);

    const cursor = e.target.selectionStart;
    const upToCursor = next.slice(0, cursor);
    const atIndex = upToCursor.lastIndexOf("@");

    if (atIndex === -1) {
      setMentionQuery(null);
      return;
    }
    const afterAt = upToCursor.slice(atIndex + 1);
    // Bail out of mention mode once whitespace/newline breaks the run of typed characters —
    // otherwise "@foo bar baz" would keep matching forever with an ever-growing query.
    if (/\s/.test(afterAt)) {
      setMentionQuery(null);
      return;
    }
    setMentionQuery(afterAt);
    setMentionStart(atIndex);
    setHighlighted(0);
  }

  function pickUser(user: WorkspaceUser) {
    if (mentionStart === null) return;
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, mentionStart);
    const after = value.slice(cursor);
    const inserted = `@${displayName(user)} `;
    const next = `${before}${inserted}${after}`;
    onChange(next);
    setMentionQuery(null);
    setMentionStart(null);

    requestAnimationFrame(() => {
      const pos = before.length + inserted.length;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery === null || matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => (h + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => (h - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pickUser(matches[highlighted]);
    } else if (e.key === "Escape") {
      setMentionQuery(null);
    }
  }

  return (
    <div className="relative h-full">
      <textarea
        ref={textareaRef}
        autoFocus={autoFocus}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setMentionQuery(null), 150)} // allow the click on a dropdown item to land first
        placeholder={placeholder}
        className={className}
      />

      {mentionQuery !== null && matches.length > 0 && (
        <div className="absolute left-0 bottom-full mb-1 w-56 border border-border rounded-lg bg-surface shadow-lg z-20 py-1 max-h-48 overflow-y-auto">
          {matches.map((u, i) => (
            <button
              key={u.id}
              onMouseDown={(e) => e.preventDefault()} // keep textarea focus so onBlur doesn't fire first
              onClick={() => pickUser(u)}
              className={`w-full text-left px-3 py-1.5 text-[13px] transition-colors truncate ${
                i === highlighted ? "bg-muted" : "hover:bg-muted"
              }`}
            >
              {displayName(u)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
