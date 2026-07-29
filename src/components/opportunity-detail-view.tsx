"use client";

import { useState, useTransition } from "react";
import type { Company, Email, EmailOpen, EmailOpportunity, List, Opportunity, OpportunityPerson, Person, PipelineStage } from "@prisma/client";
import { OpportunityHighlightsBar } from "@/components/opportunity-highlights-bar";
import { OpportunityDetailPanel } from "@/components/opportunity-detail-panel";
import { OpportunityRelationshipsPanel } from "@/components/opportunity-relationships-panel";
import { PipelineStepper } from "@/components/pipeline-stepper";
import { OpportunityTabs } from "@/components/opportunity-tabs";
import { moveOpportunityStage } from "@/lib/actions/opportunities";
import type { OpportunityRow, OpportunityStage } from "@/components/opportunities-view";
import type { ActivityEntry } from "@/components/activity-timeline";
import type { TaskWithDeals } from "@/components/task-list-row";
import type { NoteWithDeals } from "@/components/contact-notes-tab";
import type { MailboxOption } from "@/components/email-composer";
import type { CustomFieldType } from "@/lib/actions/custom-fields";
import type { NextStep } from "@/lib/next-step";

type WorkspaceUser = { id: string; name: string | null; email: string | null };
type StakeholderLink = OpportunityPerson & { person: Person & { company: Company | null } };
type CustomFieldValue = {
  id: string;
  label: string;
  type: CustomFieldType;
  options: string[];
  value: string;
};

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
  stakeholders,
  customFields,
  nextStep,
}: {
  opportunity: OpportunityRow;
  index: number;
  total: number;
  stages: PipelineStage[];
  events: ActivityEntry[];
  tasks: TaskWithDeals[];
  emails: (Email & {
    opens: EmailOpen[];
    opportunities: (EmailOpportunity & { opportunity: Opportunity })[];
    campaignMember?: { campaign: { id: string; name: string } } | null;
  })[];
  notes: NoteWithDeals[];
  isFavorited: boolean;
  mailboxes: MailboxOption[];
  lists: List[];
  users: WorkspaceUser[];
  stakeholders: StakeholderLink[];
  customFields: CustomFieldValue[];
  nextStep: NextStep;
}) {
  const [opportunity, setOpportunity] = useState(initial);
  const [, startTransition] = useTransition();
  const stageByLabel = new Map(stages.map((s) => [s.label, s]));

  function setStage(stage: OpportunityStage) {
    const target = stageByLabel.get(stage);
    const isLost = target?.outcome === "lost";

    // Ask once, at the moment the deal is marked lost — a reason captured later is a reason
    // nobody writes. Cancelling the prompt still moves the stage; it just leaves it blank.
    const lostReason = isLost ? window.prompt(`Why was "${opportunity.name || "this deal"}" lost?`) ?? "" : "";

    const closeDate = target && target.outcome !== "open" ? new Date() : null;
    setOpportunity((prev) => ({
      ...prev,
      stage,
      closeDate,
      lostReason: isLost ? lostReason || prev.lostReason : null,
    }));
    startTransition(() => moveOpportunityStage(opportunity.id, stage, lostReason));
  }

  return (
    <div className="flex flex-col h-screen">
      <OpportunityHighlightsBar
        opportunityId={opportunity.id}
        name={opportunity.name}
        index={index}
        total={total}
        stage={opportunity.stage}
        value={opportunity.value}
        currency={opportunity.currency}
        probability={opportunity.probability}
        stageProbability={stageByLabel.get(opportunity.stage)?.probability ?? null}
        expectedCloseDate={opportunity.expectedCloseDate}
        ownerId={opportunity.ownerId}
        company={opportunity.company}
        contact={opportunity.contact}
        isFavorited={isFavorited}
        mailboxes={mailboxes}
        users={users}
        nextStep={nextStep}
      />
      <PipelineStepper stage={opportunity.stage} stages={stages} onChange={setStage} />
      <div className="flex flex-1 min-h-0">
        <OpportunityDetailPanel
          opportunity={opportunity}
          stages={stages}
          onStageChange={setStage}
          users={users}
          customFields={customFields}
        />
        <div className="flex-1 min-w-0 overflow-y-auto">
          <OpportunityTabs
            events={events}
            opportunityId={opportunity.id}
            personId={opportunity.contact?.id ?? null}
            personEmail={opportunity.contact?.email ?? null}
            unsubscribed={!!opportunity.contact?.unsubscribedAt}
            contactName={
              opportunity.contact
                ? [opportunity.contact.firstName, opportunity.contact.lastName].filter(Boolean).join(" ")
                : ""
            }
            tasks={tasks}
            emails={emails}
            notes={notes}
            mailboxes={mailboxes}
            users={users}
          />
        </div>
        <OpportunityRelationshipsPanel
          opportunityId={opportunity.id}
          company={opportunity.company}
          primaryContact={opportunity.contact}
          stakeholders={stakeholders}
          lists={lists}
        />
      </div>
    </div>
  );
}
