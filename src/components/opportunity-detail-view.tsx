"use client";

import { useState, useTransition } from "react";
import type { Email, EmailOpen, EmailOpportunity, List, Opportunity, PipelineStage } from "@prisma/client";
import { OpportunityHeaderBar } from "@/components/opportunity-header-bar";
import { OpportunityDetailPanel } from "@/components/opportunity-detail-panel";
import { PipelineStepper } from "@/components/pipeline-stepper";
import { OpportunityTabs } from "@/components/opportunity-tabs";
import { moveOpportunityStage } from "@/lib/actions/opportunities";
import type { OpportunityRow, OpportunityStage } from "@/components/opportunities-view";
import type { ActivityEntry } from "@/components/activity-timeline";
import type { TaskWithDeals } from "@/components/task-list-row";
import type { NoteWithDeals } from "@/components/contact-notes-tab";
import type { MailboxOption } from "@/components/email-composer";

type WorkspaceUser = { id: string; name: string | null; email: string | null };

export function OpportunityDetailView({
  opportunity: initial,
  index,
  total,
  stages,
  events,
  tasks,
  emails,
  notes,
  isFavorited,
  mailboxes,
  lists,
  users,
}: {
  opportunity: OpportunityRow;
  index: number;
  total: number;
  stages: PipelineStage[];
  events: ActivityEntry[];
  tasks: TaskWithDeals[];
  emails: (Email & { opens: EmailOpen[]; opportunities: (EmailOpportunity & { opportunity: Opportunity })[] })[];
  notes: NoteWithDeals[];
  isFavorited: boolean;
  mailboxes: MailboxOption[];
  lists: List[];
  users: WorkspaceUser[];
}) {
  const [opportunity, setOpportunity] = useState(initial);
  const [, startTransition] = useTransition();
  const stageByLabel = new Map(stages.map((s) => [s.label, s]));

  function setStage(stage: OpportunityStage) {
    const target = stageByLabel.get(stage);
    const closeDate = target && target.outcome !== "open" ? new Date() : null;
    setOpportunity((prev) => ({ ...prev, stage, closeDate }));
    startTransition(() => moveOpportunityStage(opportunity.id, stage));
  }

  return (
    <div className="flex flex-col h-screen">
      <OpportunityHeaderBar
        opportunityId={opportunity.id}
        name={opportunity.name || "Untitled"}
        index={index}
        total={total}
        stage={opportunity.stage}
        contact={opportunity.contact}
        isFavorited={isFavorited}
        mailboxes={mailboxes}
      />
      <PipelineStepper stage={opportunity.stage} stages={stages} onChange={setStage} />
      <div className="flex flex-1 min-h-0">
        <OpportunityDetailPanel opportunity={opportunity} stages={stages} onStageChange={setStage} lists={lists} users={users} />
        <div className="flex-1 min-w-0 overflow-y-auto">
          <OpportunityTabs
            events={events}
            opportunityId={opportunity.id}
            personId={opportunity.contact?.id ?? null}
            personEmail={opportunity.contact?.email ?? null}
            contactName={
              opportunity.contact
                ? [opportunity.contact.firstName, opportunity.contact.lastName].filter(Boolean).join(" ")
                : ""
            }
            tasks={tasks}
            emails={emails}
            notes={notes}
            mailboxes={mailboxes}
          />
        </div>
      </div>
    </div>
  );
}
