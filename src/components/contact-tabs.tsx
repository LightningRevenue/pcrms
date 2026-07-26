"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type {
  Call,
  CallOpportunity,
  Email,
  EmailOpen,
  EmailOpportunity,
  Note,
  NoteOpportunity,
  Opportunity,
  Task,
  TaskOpportunity,
  User,
} from "@prisma/client";
import { History, CheckSquare, FileText, Paperclip, Mail, Calendar, Phone, Activity, Layers } from "lucide-react";
import { ActivityTimeline, type ActivityEntry } from "@/components/activity-timeline";
import { EmailThreadList } from "@/components/email-thread-list";
import type { MailboxOption } from "@/components/email-composer";
import { ContactTasksTab } from "@/components/contact-tasks-tab";
import { ContactNotesTab } from "@/components/contact-notes-tab";
import { ContactCallsTab } from "@/components/contact-calls-tab";
import { ContactActivityFeed } from "@/components/contact-activity-feed";

const GROUPS = [
  { key: "history", label: "Audit & Timeline", icon: History },
  { key: "activities", label: "Activities", icon: Activity },
] as const;

type GroupKey = (typeof GROUPS)[number]["key"];

// Second-level tabs, one set per group. Activity rows are split by kind: field edits are the
// audit trail, business events (emails sent, calls, tasks) are the timeline.
const SUBTABS = {
  history: [
    { key: "audit", label: "Audit", icon: History },
    { key: "timeline", label: "Timeline", icon: Activity },
  ],
  activities: [
    { key: "all", label: "All", icon: Layers },
    { key: "tasks", label: "Tasks", icon: CheckSquare },
    { key: "notes", label: "Notes", icon: FileText },
    { key: "files", label: "Files", icon: Paperclip },
    { key: "emails", label: "Emails", icon: Mail },
    { key: "calls", label: "Calls", icon: Phone },
    { key: "calendar", label: "Calendar", icon: Calendar },
  ],
} as const;

type SubTabKey = (typeof SUBTABS)[GroupKey][number]["key"];

// Kinds that describe something that happened with the contact rather than a field edit.
const TIMELINE_KINDS = new Set([
  "created",
  "opportunity_created",
  "stage_changed",
  "task_created",
  "task_completed",
  "email_sent",
  "call_logged",
]);

export function ContactTabs({
  events,
  personId,
  personName,
  personEmail,
  unsubscribed = false,
  emails,
  tasks,
  notes,
  opportunities,
  mailboxes,
  calls,
  users = [],
  defaultTab,
}: {
  events: ActivityEntry[];
  personId: string;
  personName: string;
  personEmail: string | null;
  unsubscribed?: boolean;
  emails: (Email & {
    opens: EmailOpen[];
    opportunities: (EmailOpportunity & { opportunity: Opportunity })[];
    campaignMember?: { campaign: { id: string; name: string } } | null;
  })[];
  tasks: (Task & { opportunities: (TaskOpportunity & { opportunity: Opportunity })[] })[];
  notes: (Note & { createdBy: User | null; opportunities: (NoteOpportunity & { opportunity: Opportunity })[] })[];
  opportunities: Opportunity[];
  mailboxes: MailboxOption[];
  calls: (Call & { createdBy: User | null; opportunities: CallOpportunity[] })[];
  users?: { id: string; name: string | null; email: string | null }[];
  // Which sub-tab to land on with no ?tab= — /lead/[id] opens the merged activity feed,
  // /contacts/[id] keeps its original audit-first behaviour.
  defaultTab?: SubTabKey;
}) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const initialEmailId = searchParams.get("emailId");

  // ?tab= still accepts every old key (timeline, tasks, emails, …) so existing links keep
  // working — each one now resolves to its group plus that sub-tab.
  const resolved = (initialTab as SubTabKey | null) ?? defaultTab;
  const resolvedGroup =
    (Object.keys(SUBTABS) as GroupKey[]).find((g) => SUBTABS[g].some((t) => t.key === resolved)) ??
    "history";
  const [group, setGroup] = useState<GroupKey>(resolvedGroup);
  const [sub, setSub] = useState<SubTabKey>(resolved ?? SUBTABS[resolvedGroup][0].key);

  function selectGroup(next: GroupKey) {
    setGroup(next);
    setSub(SUBTABS[next][0].key);
  }

  const counts: Partial<Record<SubTabKey, number>> = {
    tasks: tasks.filter((t) => !t.done).length,
    notes: notes.length,
    emails: emails.length,
    calls: calls.length,
  };

  return (
    <div>
      {/* Two levels, one visual language: the group row owns the underline, sub-tabs stay
          quiet (colour + weight only) so they read as subordinate rather than competing. */}
      <div className="flex items-center gap-5 border-b border-border px-8">
        {GROUPS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => selectGroup(key)}
            className={`flex items-center gap-1.5 py-3 text-[13px] border-b-2 -mb-px transition-colors ${
              group === key
                ? "border-foreground font-medium"
                : "border-transparent text-subtle hover:text-foreground"
            }`}
          >
            <Icon size={14} strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 border-b border-border px-8 py-2.5">
        {SUBTABS[group].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSub(key)}
            className={`flex items-center gap-1.5 text-[13px] transition-colors ${
              sub === key ? "font-medium" : "text-subtle hover:text-foreground"
            }`}
          >
            <Icon size={14} strokeWidth={1.75} />
            {label}
            {counts[key] !== undefined && (
              <span
                className={`text-[11px] px-1.5 rounded-full ${
                  sub === key ? "bg-muted text-foreground" : "bg-muted/50 text-subtle"
                }`}
              >
                {counts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="px-8 py-6">
        {sub === "audit" ? (
          <ActivityTimeline events={events.filter((e) => !TIMELINE_KINDS.has(e.kind))} />
        ) : sub === "timeline" ? (
          <ActivityTimeline events={events.filter((e) => TIMELINE_KINDS.has(e.kind))} />
        ) : sub === "all" ? (
          <ContactActivityFeed
            personName={personName}
            emails={emails}
            notes={notes}
            calls={calls}
            tasks={tasks}
            users={users}
          />
        ) : sub === "tasks" ? (
          <ContactTasksTab personId={personId} contactName={personName} tasks={tasks} opportunities={opportunities} />
        ) : sub === "notes" ? (
          <ContactNotesTab personId={personId} contactName={personName} notes={notes} opportunities={opportunities} users={users} />
        ) : sub === "emails" ? (
          <EmailThreadList
            personId={personId}
            personName={personName}
            personEmail={personEmail}
            unsubscribed={unsubscribed}
            emails={emails}
            initialExpandedId={initialEmailId}
            opportunities={opportunities}
            mailboxes={mailboxes}
          />
        ) : sub === "calls" ? (
          <ContactCallsTab calls={calls} personId={personId} opportunities={opportunities} />
        ) : (
          <p className="text-[13px] text-subtle">Coming soon.</p>
        )}
      </div>
    </div>
  );
}
