"use client";

import type { PipelineStage } from "@prisma/client";
import {
  DollarSign,
  Milestone,
  CalendarDays,
  Building2,
  User,
  UserCircle,
  Percent,
  Coins,
  Compass,
  Footprints,
  ThumbsDown,
} from "lucide-react";
import { FieldSection } from "@/components/field-section";
import { FieldRow } from "@/components/field-row";
import { EditableFieldRow } from "@/components/editable-field-row";
import { CustomFieldsSection } from "@/components/custom-fields-section";
import { OwnerSelect } from "@/components/owner-select";
import { UnsubscribeToggle } from "@/components/unsubscribe-toggle";
import {
  setOpportunityOwner,
  setExpectedCloseDate,
  setOpportunityValue,
  setOpportunityProbability,
  updateOpportunityField,
} from "@/lib/actions/opportunities";
import type { OpportunityRow, OpportunityStage } from "@/components/opportunities-view";
import type { CustomFieldType } from "@/lib/actions/custom-fields";
import { CURRENCIES, formatMoney } from "@/lib/currency";

type WorkspaceUser = { id: string; name: string | null; email: string | null };
type CustomFieldValue = {
  id: string;
  label: string;
  type: CustomFieldType;
  options: string[];
  value: string;
};

function contactName(contact: OpportunityRow["contact"]) {
  if (!contact) return "";
  return [contact.firstName, contact.lastName].filter(Boolean).join(" ");
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

const OUTCOME_BADGE: Record<string, string> = {
  open: "bg-blue-500 text-white",
  won: "bg-emerald-500 text-white",
  lost: "bg-rose-500 text-white",
};

export function OpportunityDetailPanel({
  opportunity,
  stages,
  onStageChange,
  users,
  customFields,
}: {
  opportunity: OpportunityRow;
  stages: PipelineStage[];
  onStageChange: (stage: OpportunityStage) => void;
  users: WorkspaceUser[];
  customFields: CustomFieldValue[];
}) {
  const currentStage = stages.find((s) => s.label === opportunity.stage);
  const contact = contactName(opportunity.contact);
  const createdBy = opportunity.createdBy?.name ?? opportunity.createdBy?.email ?? "—";
  const createdAt = relativeTime(opportunity.createdAt);

  function changeOwner(ownerId: string | null) {
    setOpportunityOwner(opportunity.id, ownerId);
  }

  function changeExpectedCloseDate(value: string) {
    setExpectedCloseDate(opportunity.id, value ? new Date(value) : null);
  }

  const isOpen = currentStage?.outcome === "open";

  return (
    <aside className="w-80 shrink-0 border-r border-border h-full overflow-y-auto px-5 py-6">
      {/* Name/avatar live in the highlights bar now, so the panel opens straight on the fields.
          -mt-2 cancels FieldSection's own py-2 so "Deal" sits level with "Company" on the right. */}
      <div className="-mt-2">
        <FieldSection title="Deal">
          <EditableFieldRow
            icon={DollarSign}
            label="Amount"
            type="number"
            value={String(opportunity.value)}
            placeholder={formatMoney(0, opportunity.currency)}
            onSave={async (v) => setOpportunityValue(opportunity.id, Number(v))}
          />
          <EditableFieldRow
            icon={Coins}
            label="Currency"
            type="select"
            value={opportunity.currency}
            options={[...CURRENCIES]}
            onSave={async (v) => updateOpportunityField(opportunity.id, "currency", v || "USD")}
          />
          <div className="flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-muted transition-colors">
            <div className="flex items-center gap-2 w-28 shrink-0 text-[13px] text-subtle">
              <Milestone size={14} strokeWidth={1.75} />
              Stage
            </div>
            <div className="relative">
              <select
                value={opportunity.stage}
                onChange={(e) => onStageChange(e.target.value as OpportunityStage)}
                className={`appearance-none cursor-pointer px-2 py-0.5 pr-5 rounded-full text-[12px] font-medium outline-none ${
                  currentStage ? OUTCOME_BADGE[currentStage.outcome] ?? "bg-muted" : "bg-muted"
                }`}
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.label} className="bg-background text-foreground">
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <FieldRow
            icon={CalendarDays}
            label="Close date"
            value={opportunity.closeDate ? opportunity.closeDate.toLocaleDateString() : "—"}
          />
          {isOpen && (
            <div className="flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-muted transition-colors">
              <div className="flex items-center gap-2 w-28 shrink-0 text-[13px] text-subtle">
                <CalendarDays size={14} strokeWidth={1.75} />
                Expected close
              </div>
              <input
                type="date"
                defaultValue={opportunity.expectedCloseDate ? opportunity.expectedCloseDate.toISOString().slice(0, 10) : ""}
                onChange={(e) => changeExpectedCloseDate(e.target.value)}
                className="flex-1 bg-transparent outline-none text-[13px] border-b border-transparent hover:border-border focus:border-accent transition-colors"
              />
            </div>
          )}
          {/* Empty = inherit the stage's probability, so the placeholder shows what you'd get. */}
          <EditableFieldRow
            icon={Percent}
            label="Probability"
            type="number"
            value={opportunity.probability === null ? "" : String(opportunity.probability)}
            placeholder={
              currentStage?.probability === null || currentStage?.probability === undefined
                ? "Not set"
                : `${currentStage.probability}% (stage)`
            }
            onSave={async (v) => setOpportunityProbability(opportunity.id, v === "" ? null : Number(v))}
          />
          <EditableFieldRow
            icon={Compass}
            label="Source"
            value={opportunity.source ?? ""}
            placeholder="Where it came from"
            onSave={async (v) => updateOpportunityField(opportunity.id, "source", v)}
          />
          <EditableFieldRow
            icon={Footprints}
            label="Next step"
            value={opportunity.nextStepNote ?? ""}
            placeholder="What's the next move?"
            onSave={async (v) => updateOpportunityField(opportunity.id, "nextStepNote", v)}
          />
          {currentStage?.outcome === "lost" && (
            <EditableFieldRow
              icon={ThumbsDown}
              label="Lost reason"
              value={opportunity.lostReason ?? ""}
              placeholder="Why was it lost?"
              onSave={async (v) => updateOpportunityField(opportunity.id, "lostReason", v)}
            />
          )}
        </FieldSection>

        <FieldSection title="Relations">
          <FieldRow icon={Building2} label="Company" value={opportunity.company?.name ?? ""} placeholder="Company" />
          <FieldRow icon={User} label="Point of ..." value={contact} />
          <div className="flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-muted transition-colors">
            <div className="flex items-center gap-2 w-28 shrink-0 text-[13px] text-subtle">
              <UserCircle size={14} strokeWidth={1.75} />
              Owner
            </div>
            <OwnerSelect users={users} ownerId={opportunity.ownerId} onChange={changeOwner} />
          </div>
          {opportunity.contact && (
            <UnsubscribeToggle personId={opportunity.contact.id} unsubscribedAt={opportunity.contact.unsubscribedAt} />
          )}
        </FieldSection>

        <CustomFieldsSection objectType="opportunity" recordId={opportunity.id} fields={customFields} />

        <FieldSection title="System">
          <FieldRow icon={CalendarDays} label="Creation date" value={createdAt} />
          <FieldRow icon={UserCircle} label="Created by" value={createdBy} />
        </FieldSection>
      </div>
    </aside>
  );
}
