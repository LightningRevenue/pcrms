"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Link2, Banknote, MapPin, CalendarDays, UserCircle, Plus, ArrowUpRight, X } from "lucide-react";
import type { Company, ImportBatch, List, Opportunity, Person, User } from "@prisma/client";
import { FieldSection } from "@/components/field-section";
import { FieldRow } from "@/components/field-row";
import { EditableFieldRow } from "@/components/editable-field-row";
import { CustomFieldsSection } from "@/components/custom-fields-section";
import { LinkPersonPopover } from "@/components/link-person-popover";
import { CompanyLogo } from "@/components/company-logo";
import { EntityListsSection } from "@/components/entity-lists-section";
import { updateCompanyField, unlinkPersonFromCompany, type CompanyField } from "@/lib/actions/companies";
import type { getCustomFieldValues } from "@/lib/actions/custom-fields";

type CompanyWithRelations = Company & { createdBy: User | null; importBatch: ImportBatch | null };

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

export function CompanyDetailPanel({
  company,
  people,
  customFields,
  opportunities,
  lists,
}: {
  company: CompanyWithRelations;
  people: Person[];
  customFields: Awaited<ReturnType<typeof getCustomFieldValues>>;
  opportunities: Opportunity[];
  lists: List[];
}) {
  const [name, setName] = useState(company.name);
  const [, startTransition] = useTransition();
  const createdAt = relativeTime(company.createdAt);
  const createdBy = company.importBatch?.name ?? company.createdBy?.name ?? company.createdBy?.email ?? "—";

  function save(field: CompanyField, value: string) {
    startTransition(() => updateCompanyField(company.id, field, value));
  }

  return (
    <aside className="w-80 shrink-0 border-r border-border h-[calc(100vh-3.5rem)] overflow-y-auto px-5 py-6">
      <div className="flex items-center gap-1.5">
        <CompanyLogo domain={company.domain} fallbackText="" size={16} className="bg-transparent border-0" />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== company.name && save("name", name)}
          className="min-w-0 flex-1 bg-transparent text-[17px] font-medium outline-none border-b border-transparent hover:border-border focus:border-border transition-colors"
        />
      </div>
      <p className="text-[12px] text-subtle mt-0.5">Added {createdAt}</p>

      <div className="mt-6 border-t border-border">
        <p className="text-[12px] font-medium text-subtle uppercase tracking-wide pt-4 px-1">
          Fields
        </p>

        <FieldSection title="General">
          <EditableFieldRow icon={Link2} label="Domain Name" value={company.domain ?? ""} placeholder="Domain Name" onSave={(v) => updateCompanyField(company.id, "domain", v)} />
        </FieldSection>

        <FieldSection title="Business">
          <EditableFieldRow icon={Banknote} label="Revenue" value={company.annualRevenue ?? ""} placeholder="Annual Revenue" onSave={(v) => updateCompanyField(company.id, "annualRevenue", v)} />
        </FieldSection>

        <FieldSection title="Contact">
          <EditableFieldRow icon={MapPin} label="Address" value={company.address ?? ""} placeholder="Address" onSave={(v) => updateCompanyField(company.id, "address", v)} />
          <EditableFieldRow icon={Link2} label="Linkedin" value={company.linkedin ?? ""} placeholder="Linkedin" onSave={(v) => updateCompanyField(company.id, "linkedin", v)} />
        </FieldSection>

        <FieldSection title="System">
          <FieldRow icon={CalendarDays} label="Creation date" value={createdAt} muted />
          <FieldRow icon={UserCircle} label="Created by" value={createdBy} muted />
        </FieldSection>

        <CustomFieldsSection objectType="company" recordId={company.id} fields={customFields} />
      </div>

      <div className="mt-2 border-t border-border pt-4 space-y-4">
        <div>
          <div className="flex items-center justify-between px-1">
            <span className="text-[13px] font-medium">People</span>
            <LinkPersonPopover companyId={company.id} />
          </div>
          {people.length > 0 && (
            <div className="mt-1.5 space-y-0.5">
              {people.map((p) => (
                <div key={p.id} className="flex items-center rounded-md hover:bg-muted transition-colors group">
                  <Link
                    href={`/contacts/${p.id}`}
                    className="flex-1 min-w-0 flex items-center gap-1.5 px-1 py-1 text-[13px]"
                  >
                    <span className="truncate">{[p.firstName, p.lastName].filter(Boolean).join(" ")}</span>
                    <ArrowUpRight size={12} strokeWidth={1.75} className="text-subtle opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </Link>
                  <button
                    onClick={() => unlinkPersonFromCompany(company.id, p.id)}
                    className="p-1 mr-0.5 rounded text-subtle opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity shrink-0"
                    title="Unlink"
                  >
                    <X size={12} strokeWidth={1.75} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <SidePanelSection title="Opportunities" />
          {opportunities.length > 0 && (
            <div className="mt-1.5 space-y-0.5">
              {opportunities.map((o) => (
                <Link
                  key={o.id}
                  href={`/deals/${o.id}`}
                  className="flex items-center gap-1.5 rounded-md px-1 py-1 text-[13px] hover:bg-muted transition-colors group"
                >
                  <Banknote size={13} strokeWidth={1.75} className="text-subtle shrink-0" />
                  <span className="truncate flex-1 min-w-0">{o.name}</span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-subtle shrink-0">{o.stage}</span>
                  <span className="text-subtle shrink-0">${o.value.toLocaleString()}</span>
                  <ArrowUpRight size={12} strokeWidth={1.75} className="text-subtle opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>

        <EntityListsSection entityType="company" entityId={company.id} lists={lists} />
      </div>
    </aside>
  );
}

function SidePanelSection({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between px-1">
      <span className="text-[13px] font-medium">{title}</span>
      <div className="flex items-center gap-1">
        <button className="text-subtle hover:text-foreground transition-colors">
          <ArrowUpRight size={15} strokeWidth={1.75} />
        </button>
        <button className="text-subtle hover:text-foreground transition-colors">
          <Plus size={15} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
