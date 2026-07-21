"use client";

import { useState } from "react";
import type { Email, EmailOpen, EmailOpportunity, Opportunity } from "@prisma/client";
import { History, CheckSquare, FileText, Paperclip, Mail, Calendar } from "lucide-react";
import { ActivityTimeline, type ActivityEntry } from "@/components/activity-timeline";
import { EmailThreadList } from "@/components/email-thread-list";
import { OpportunityTasksTab } from "@/components/opportunity-tasks-tab";
import { OpportunityNotesTab } from "@/components/opportunity-notes-tab";
import type { TaskWithDeals } from "@/components/task-list-row";
import type { NoteWithDeals } from "@/components/contact-notes-tab";
import type { MailboxOption } from "@/components/email-composer";

const TABS = [
  { key: "timeline", label: "Timeline", icon: History },
  { key: "tasks", label: "Tasks", icon: CheckSquare },
  { key: "notes", label: "Notes", icon: FileText },
  { key: "files", label: "Files", icon: Paperclip },
  { key: "emails", label: "Emails", icon: Mail },
  { key: "calendar", label: "Calendar", icon: Calendar },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function OpportunityTabs({
  events,
  opportunityId,
  personId,
  personEmail,
  contactName,
  tasks,
  emails,
  notes,
  mailboxes,
}: {
  events: ActivityEntry[];
  opportunityId: string;
  personId: string | null;
  personEmail: string | null;
  contactName: string;
  tasks: TaskWithDeals[];
  emails: (Email & {
    opens: EmailOpen[];
    opportunities: (EmailOpportunity & { opportunity: Opportunity })[];
    campaignMember?: { campaign: { id: string; name: string } } | null;
  })[];
  notes: NoteWithDeals[];
  mailboxes: MailboxOption[];
}) {
  const [active, setActive] = useState<TabKey>("timeline");

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
          <OpportunityTasksTab
            personId={personId}
            contactName={contactName}
            opportunityId={opportunityId}
            tasks={tasks}
          />
        ) : active === "notes" ? (
          <OpportunityNotesTab
            personId={personId}
            contactName={contactName}
            opportunityId={opportunityId}
            notes={notes}
          />
        ) : active === "emails" ? (
          personId ? (
            <EmailThreadList
              personId={personId}
              personName={contactName}
              personEmail={personEmail}
              emails={emails.filter((e) => e.opportunities.some((o) => o.opportunityId === opportunityId))}
              mailboxes={mailboxes}
              context="opportunity"
              defaultOpportunityId={opportunityId}
            />
          ) : (
            <p className="text-[13px] text-subtle">No point of contact on this deal.</p>
          )
        ) : (
          <p className="text-[13px] text-subtle">Coming soon.</p>
        )}
      </div>
    </div>
  );
}
