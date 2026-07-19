"use client";

import { useState } from "react";
import type { Email, EmailOpen, EmailOpportunity, Note, NoteOpportunity, Opportunity, Person, Task, TaskOpportunity, User } from "@prisma/client";
import { History, CheckSquare, FileText, Paperclip, Mail, Calendar } from "lucide-react";
import { ActivityTimeline, type ActivityEntry } from "@/components/activity-timeline";
import { CompanyTasksTab } from "@/components/company-tasks-tab";
import { CompanyEmailsTab } from "@/components/company-emails-tab";
import { CompanyNotesTab } from "@/components/company-notes-tab";

const TABS = [
  { key: "timeline", label: "Timeline", icon: History },
  { key: "tasks", label: "Tasks", icon: CheckSquare },
  { key: "notes", label: "Notes", icon: FileText },
  { key: "files", label: "Files", icon: Paperclip },
  { key: "emails", label: "Emails", icon: Mail },
  { key: "calendar", label: "Calendar", icon: Calendar },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function CompanyTabs({
  events,
  tasks,
  emails,
  notes,
}: {
  events: ActivityEntry[];
  tasks: (Task & { person: Person; opportunities: (TaskOpportunity & { opportunity: Opportunity })[] })[];
  emails: (Email & {
    person: Person;
    opens: EmailOpen[];
    opportunities: (EmailOpportunity & { opportunity: Opportunity })[];
  })[];
  notes: (Note & {
    person: Person;
    createdBy: User | null;
    opportunities: (NoteOpportunity & { opportunity: Opportunity })[];
  })[];
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
          <CompanyTasksTab tasks={tasks} />
        ) : active === "notes" ? (
          <CompanyNotesTab notes={notes} />
        ) : active === "emails" ? (
          <CompanyEmailsTab emails={emails} />
        ) : (
          <p className="text-[13px] text-subtle">Coming soon.</p>
        )}
      </div>
    </div>
  );
}
