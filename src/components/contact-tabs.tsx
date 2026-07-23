"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type {
  Call,
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
import { History, CheckSquare, FileText, Paperclip, Mail, Calendar, Phone } from "lucide-react";
import { ActivityTimeline, type ActivityEntry } from "@/components/activity-timeline";
import { EmailThreadList } from "@/components/email-thread-list";
import type { MailboxOption } from "@/components/email-composer";
import { ContactTasksTab } from "@/components/contact-tasks-tab";
import { ContactNotesTab } from "@/components/contact-notes-tab";
import { ContactCallsTab } from "@/components/contact-calls-tab";

const TABS = [
  { key: "timeline", label: "Timeline", icon: History },
  { key: "tasks", label: "Tasks", icon: CheckSquare },
  { key: "notes", label: "Notes", icon: FileText },
  { key: "files", label: "Files", icon: Paperclip },
  { key: "emails", label: "Emails", icon: Mail },
  { key: "calls", label: "Calls", icon: Phone },
  { key: "calendar", label: "Calendar", icon: Calendar },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function ContactTabs({
  events,
  personId,
  personName,
  personEmail,
  emails,
  tasks,
  notes,
  opportunities,
  mailboxes,
  calls,
  users = [],
}: {
  events: ActivityEntry[];
  personId: string;
  personName: string;
  personEmail: string | null;
  emails: (Email & {
    opens: EmailOpen[];
    opportunities: (EmailOpportunity & { opportunity: Opportunity })[];
    campaignMember?: { campaign: { id: string; name: string } } | null;
  })[];
  tasks: (Task & { opportunities: (TaskOpportunity & { opportunity: Opportunity })[] })[];
  notes: (Note & { createdBy: User | null; opportunities: (NoteOpportunity & { opportunity: Opportunity })[] })[];
  opportunities: Opportunity[];
  mailboxes: MailboxOption[];
  calls: (Call & { createdBy: User | null })[];
  users?: { id: string; name: string | null; email: string | null }[];
}) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const initialEmailId = searchParams.get("emailId");
  const [active, setActive] = useState<TabKey>(
    TABS.some((t) => t.key === initialTab) ? (initialTab as TabKey) : "timeline"
  );

  return (
    <div>
      <div className="flex items-center gap-5 border-b border-border px-8">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActive(key)}
            className={`flex items-center gap-1.5 py-3 text-[13px] border-b-2 -mb-px transition-colors ${
              active === key
                ? "border-foreground font-medium"
                : "border-transparent text-subtle hover:text-foreground"
            }`}
          >
            <Icon size={14} strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </div>

      <div className="px-8 py-6">
        {active === "timeline" ? (
          <ActivityTimeline events={events} />
        ) : active === "tasks" ? (
          <ContactTasksTab personId={personId} contactName={personName} tasks={tasks} opportunities={opportunities} />
        ) : active === "notes" ? (
          <ContactNotesTab personId={personId} contactName={personName} notes={notes} opportunities={opportunities} users={users} />
        ) : active === "emails" ? (
          <EmailThreadList
            personId={personId}
            personName={personName}
            personEmail={personEmail}
            emails={emails}
            initialExpandedId={initialEmailId}
            opportunities={opportunities}
            mailboxes={mailboxes}
          />
        ) : active === "calls" ? (
          <ContactCallsTab calls={calls} />
        ) : (
          <p className="text-[13px] text-subtle">Coming soon.</p>
        )}
      </div>
    </div>
  );
}
