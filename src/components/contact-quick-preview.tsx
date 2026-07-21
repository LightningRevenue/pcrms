"use client";

import Link from "next/link";
import {
  X,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Link2,
  CalendarDays,
  UserCircle,
  ArrowUpRight,
  History,
  CalendarClock,
} from "lucide-react";
import type { Activity, Task } from "@prisma/client";
import type { PersonRow } from "@/components/contacts-view";
import { CompanyLogo } from "@/components/company-logo";

function fullName(p: Pick<PersonRow, "firstName" | "lastName">) {
  return [p.firstName, p.lastName].filter(Boolean).join(" ");
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

function relativeTime(date: Date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDue(date: Date) {
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-1 py-1.5">
      <div className="flex items-center gap-2 w-28 shrink-0 text-[13px] text-subtle">
        <Icon size={14} strokeWidth={1.75} />
        {label}
      </div>
      <div className="flex-1 min-w-0 text-[13px] truncate">{children}</div>
    </div>
  );
}

export function ContactQuickPreview({
  person,
  lastActivity,
  nextTask,
  onClose,
  onComposeEmail,
}: {
  person: PersonRow;
  lastActivity?: Activity;
  nextTask?: Task;
  onClose: () => void;
  onComposeEmail: (person: PersonRow) => void;
}) {
  const name = fullName(person) || "Untitled";

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-screen w-96 bg-surface border-l border-border z-40 flex flex-col shadow-xl">
        <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-border">
          <span className="text-[13px] font-medium text-subtle">Quick preview</span>
          <button onClick={onClose} className="text-subtle hover:text-foreground transition-colors shrink-0">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-5 pb-4 flex items-center gap-3 border-b border-border">
            {person.company?.domain ? (
              <CompanyLogo domain={person.company.domain} fallbackText={initials(name) || "?"} size={40} rounded="rounded-full" className="text-[13px]" />
            ) : (
              <div className="size-10 shrink-0 rounded-full flex items-center justify-center text-[13px] font-medium bg-violet-500 text-white">
                {initials(name) || "?"}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[14px] font-medium truncate">{name}</p>
              {person.jobTitle && <p className="text-[12px] text-subtle truncate">{person.jobTitle}</p>}
            </div>
          </div>

          <div className="px-3 py-3">
            {person.email && (
              <Row icon={Mail} label="Email">
                <button
                  onClick={() => onComposeEmail(person)}
                  title="Compose email"
                  className="inline-block px-2 py-0.5 rounded-md border border-border bg-muted text-foreground text-[12px] truncate max-w-full hover:bg-accent hover:text-white hover:border-accent transition-colors"
                >
                  {person.email}
                </button>
              </Row>
            )}
            {person.phone && (
              <Row icon={Phone} label="Phone">
                {person.phone}
              </Row>
            )}
            {person.company && (
              <Row icon={Building2} label="Company">
                <Link
                  href={`/companies/${person.company.id}`}
                  className="inline-block px-2 py-0.5 rounded-md border border-border bg-muted text-foreground truncate max-w-full hover:bg-accent hover:text-white hover:border-accent transition-colors"
                >
                  {person.company.name || "Untitled"}
                </Link>
              </Row>
            )}
            {person.linkedin && (
              <Row icon={Link2} label="LinkedIn">
                <a
                  href={person.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline truncate block"
                >
                  {person.linkedin}
                </a>
              </Row>
            )}
            {lastActivity && (
              <Row icon={History} label="Last activity">
                {relativeTime(lastActivity.createdAt)}
              </Row>
            )}
            {nextTask && (
              <Row icon={CalendarClock} label="Next activity">
                {nextTask.dueAt ? formatDue(nextTask.dueAt) : nextTask.title}
              </Row>
            )}
            {person.createdBy && (
              <Row icon={UserCircle} label="Created by">
                {person.createdBy.name ?? person.createdBy.email}
              </Row>
            )}
            <Row icon={CalendarDays} label="Created">
              {relativeTime(person.createdAt)}
            </Row>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-t border-border">
          {person.email && (
            <button
              onClick={() => onComposeEmail(person)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] bg-accent text-white hover:opacity-90 transition-opacity"
            >
              <Mail size={14} strokeWidth={1.75} />
              Email
            </button>
          )}
          <Link
            href={`/contacts/${person.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] border border-border text-foreground hover:bg-muted transition-colors"
          >
            View full profile
            <ArrowUpRight size={14} strokeWidth={1.75} />
          </Link>
        </div>
      </aside>
    </>
  );
}
