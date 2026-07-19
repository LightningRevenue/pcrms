"use client";

import Link from "next/link";
import type { List, PipelineStage } from "@prisma/client";
import { DollarSign, Milestone, CalendarDays, Building2, User, UserCircle, ArrowUpRight } from "lucide-react";
import { FieldSection } from "@/components/field-section";
import { FieldRow } from "@/components/field-row";
import { EntityListsSection } from "@/components/entity-lists-section";
import { OwnerSelect } from "@/components/owner-select";
import { setOpportunityOwner } from "@/lib/actions/opportunities";
import type { OpportunityRow, OpportunityStage } from "@/components/opportunities-view";

type WorkspaceUser = { id: string; name: string | null; email: string | null };

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

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
  open: "bg-blue-500/15 text-blue-300",
  won: "bg-emerald-500/15 text-emerald-300",
  lost: "bg-rose-500/15 text-rose-300",
};

export function OpportunityDetailPanel({
  opportunity,
  stages,
  onStageChange,
  lists,
  users,
}: {
  opportunity: OpportunityRow;
  stages: PipelineStage[];
  onStageChange: (stage: OpportunityStage) => void;
  lists: List[];
  users: WorkspaceUser[];
}) {
  const currentStage = stages.find((s) => s.label === opportunity.stage);
  const contact = contactName(opportunity.contact);
  const createdBy = opportunity.createdBy?.name ?? opportunity.createdBy?.email ?? "—";
  const createdAt = relativeTime(opportunity.createdAt);

  function changeOwner(ownerId: string | null) {
    setOpportunityOwner(opportunity.id, ownerId);
  }

  return (
    <aside className="w-80 shrink-0 border-r border-border h-[calc(100vh-3.5rem-2.75rem)] overflow-y-auto px-5 py-6">
      <div className="size-14 rounded-lg bg-muted border border-border flex items-center justify-center text-[18px] font-medium text-subtle">
        {opportunity.name ? opportunity.name[0].toUpperCase() : "-"}
      </div>
      <h1 className="text-[17px] font-medium mt-3">{opportunity.name || "Untitled"}</h1>
      <p className="text-[12px] text-subtle mt-0.5">Added {createdAt}</p>

      <div className="mt-6 border-t border-border">
        <p className="text-[12px] font-medium text-subtle uppercase tracking-wide pt-4 px-1">
          Fields
        </p>

        <FieldSection title="Deal">
          <FieldRow icon={DollarSign} label="Amount" value={`$${opportunity.value.toLocaleString()}`} />
          <div className="flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-muted transition-colors">
            <div className="flex items-center gap-2 w-28 shrink-0 text-[13px] text-subtle">
              <Milestone size={14} strokeWidth={1.75} />
              Stage
            </div>
            <div className="relative">
              <select
                value={opportunity.stage}
                onChange={(e) => onStageChange(e.target.value as OpportunityStage)}
                className={`appearance-none cursor-pointer px-2 py-0.5 pr-5 rounded-full text-[12px] font-medium outline-none [color-scheme:dark] ${
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
        </FieldSection>

        <FieldSection title="System">
          <FieldRow icon={CalendarDays} label="Creation date" value={createdAt} />
          <FieldRow icon={UserCircle} label="Created by" value={createdBy} />
        </FieldSection>
      </div>

      <div className="mt-2 border-t border-border pt-4 space-y-4">
        {opportunity.contact && (
          <RelatedSection title="Point of Contact">
            <Link
              href={`/contacts/${opportunity.contact.id}`}
              className="flex items-center gap-2 text-[13px] group hover:bg-muted rounded-md px-1 py-1 -mx-1 transition-colors"
            >
              <Avatar name={contact} />
              <span className="truncate">{contact}</span>
              <ArrowUpRight size={12} strokeWidth={1.75} className="text-subtle opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </Link>
          </RelatedSection>
        )}

        {opportunity.company && (
          <RelatedSection title="Company">
            <Link
              href={`/companies/${opportunity.company.id}`}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-muted text-[13px] text-subtle hover:text-foreground hover:border-subtle transition-colors"
            >
              <Building2 size={12} strokeWidth={1.75} />
              {opportunity.company.name || "Untitled"}
              <ArrowUpRight size={12} strokeWidth={1.75} className="shrink-0" />
            </Link>
          </RelatedSection>
        )}

        <EntityListsSection entityType="opportunity" entityId={opportunity.id} lists={lists} />
      </div>
    </aside>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="size-5 shrink-0 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[10px] font-medium">
      {initials(name) || "?"}
    </div>
  );
}

function RelatedSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-1">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[13px] font-medium">{title}</span>
      </div>
      {children}
    </div>
  );
}
