"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Mail, Phone, Briefcase, Link2, CalendarDays, UserCircle, Plus, Building2, ArrowUpRight, X, Banknote, GitBranch } from "lucide-react";
import type { Company, ImportBatch, List, Opportunity, Person, Sequence, SequenceEnrollment, User } from "@prisma/client";
import { FieldSection } from "@/components/field-section";
import { FieldRow } from "@/components/field-row";
import { EditableFieldRow } from "@/components/editable-field-row";
import { CustomFieldsSection } from "@/components/custom-fields-section";
import { CompanyAutocompleteField } from "@/components/company-autocomplete-field";
import { CompanyLogo } from "@/components/company-logo";
import { EntityListsSection } from "@/components/entity-lists-section";
import { OwnerSelect } from "@/components/owner-select";
import { updatePersonField, setPersonCompany, setPersonOwner, type PersonField } from "@/lib/actions/contacts";
import type { getCustomFieldValues } from "@/lib/actions/custom-fields";

type WorkspaceUser = { id: string; name: string | null; email: string | null };

type ContactWithRelations = Person & {
  company: Company | null;
  createdBy: User | null;
  owner: User | null;
  importBatch: ImportBatch | null;
};

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

type EnrollmentWithSequence = SequenceEnrollment & { sequence: Sequence };

export function ContactDetailPanel({
  contact,
  customFields,
  opportunities,
  sequenceEnrollments,
  lists,
  users,
}: {
  contact: ContactWithRelations;
  customFields: Awaited<ReturnType<typeof getCustomFieldValues>>;
  opportunities: Opportunity[];
  sequenceEnrollments: EnrollmentWithSequence[];
  lists: List[];
  users: WorkspaceUser[];
}) {
  const [firstName, setFirstName] = useState(contact.firstName);
  const [lastName, setLastName] = useState(contact.lastName ?? "");
  const [, startTransition] = useTransition();
  const createdAt = relativeTime(contact.createdAt);
  const createdBy = contact.importBatch?.name ?? contact.createdBy?.name ?? contact.createdBy?.email ?? "—";
  const name = [firstName, lastName].filter(Boolean).join(" ");

  function save(field: Exclude<PersonField, "company">, value: string) {
    startTransition(() => updatePersonField(contact.id, field, value));
  }

  return (
    <aside className="w-80 shrink-0 border-r border-border h-[calc(100vh-3.5rem)] overflow-y-auto px-5 py-6">
      <div className="flex items-center gap-1.5 flex-wrap">
        <CompanyLogo domain={contact.company?.domain} fallbackText="" size={16} className="bg-transparent border-0" />
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          onBlur={() => firstName.trim() && firstName !== contact.firstName && save("firstName", firstName)}
          size={Math.max(firstName.length, 1)}
          className="w-auto max-w-full bg-transparent text-[17px] font-medium outline-none border-b border-transparent hover:border-border focus:border-border transition-colors"
        />
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          onBlur={() => lastName !== (contact.lastName ?? "") && save("lastName", lastName)}
          placeholder="Last name"
          size={Math.max(lastName.length || 10, 1)}
          className="w-auto max-w-full bg-transparent text-[17px] font-medium outline-none border-b border-transparent hover:border-border focus:border-border transition-colors placeholder:text-subtle placeholder:font-normal"
        />
      </div>
      <p className="text-[12px] text-subtle mt-0.5">Added {createdAt}</p>

      <div className="mt-6 border-t border-border">
        <p className="text-[12px] font-medium text-subtle uppercase tracking-wide pt-4 px-1">
          Fields
        </p>

        <FieldSection title="General">
          <EditableFieldRow icon={Mail} label="Email" value={contact.email ?? ""} onSave={(v) => updatePersonField(contact.id, "email", v)} />
          <EditableFieldRow icon={Phone} label="Phone" value={contact.phone ?? ""} onSave={(v) => updatePersonField(contact.id, "phone", v)} />
        </FieldSection>

        <FieldSection title="Work">
          <CompanyAutocompleteField value={contact.company?.name ?? ""} onSelect={(c) => setPersonCompany(contact.id, c)} />
          <EditableFieldRow icon={Briefcase} label="Job Title" value={contact.jobTitle ?? ""} onSave={(v) => updatePersonField(contact.id, "jobTitle", v)} />
        </FieldSection>

        <FieldSection title="Social">
          <EditableFieldRow icon={Link2} label="LinkedIn" value={contact.linkedin ?? ""} onSave={(v) => updatePersonField(contact.id, "linkedin", v)} />
        </FieldSection>

        <FieldSection title="Relations">
          <div className="flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-muted transition-colors">
            <div className="flex items-center gap-2 w-28 shrink-0 text-[13px] text-subtle">
              <UserCircle size={14} strokeWidth={1.75} />
              Owner
            </div>
            <OwnerSelect
              users={users}
              ownerId={contact.ownerId}
              onChange={(ownerId) => setPersonOwner(contact.id, ownerId)}
            />
          </div>
        </FieldSection>

        <FieldSection title="System">
          <FieldRow icon={CalendarDays} label="Created" value={createdAt} muted />
          <FieldRow icon={UserCircle} label="Created by" value={createdBy} muted />
        </FieldSection>

        <CustomFieldsSection objectType="person" recordId={contact.id} fields={customFields} />
      </div>

      <div className="mt-2 border-t border-border pt-4 space-y-4">
        <div>
          <p className="text-[13px] font-medium px-1">Company</p>
          {contact.company ? (
            <div className="flex items-center rounded-md hover:bg-muted transition-colors mt-1.5 group">
              <Link
                href={`/companies/${contact.company.id}`}
                className="flex-1 min-w-0 flex items-center gap-1.5 px-1 py-1 text-[13px]"
              >
                <CompanyLogo domain={contact.company.domain} fallbackText="" size={14} className="bg-transparent border-0" />
                {!contact.company.domain && <Building2 size={13} strokeWidth={1.75} className="text-subtle shrink-0" />}
                <span className="truncate">{contact.company.name}</span>
                <ArrowUpRight size={12} strokeWidth={1.75} className="text-subtle opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </Link>
              <button
                onClick={() => setPersonCompany(contact.id, null)}
                className="p-1 mr-0.5 rounded text-subtle opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity shrink-0"
                title="Unlink"
              >
                <X size={12} strokeWidth={1.75} />
              </button>
            </div>
          ) : (
            <div className="mt-1.5">
              <CompanyAutocompleteField value="" onSelect={(c) => setPersonCompany(contact.id, c)} showLabel={false} />
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
        {sequenceEnrollments.length > 0 && (
          <div>
            <p className="text-[13px] font-medium px-1">Sequences</p>
            <div className="mt-1.5 space-y-0.5">
              {sequenceEnrollments.map((e) => (
                <Link
                  key={e.id}
                  href={`/sequences/${e.sequenceId}`}
                  className="flex items-center gap-1.5 rounded-md px-1 py-1 text-[13px] hover:bg-muted transition-colors group"
                >
                  <GitBranch size={13} strokeWidth={1.75} className="text-subtle shrink-0" />
                  <span className="truncate flex-1 min-w-0">Enrolled in {e.sequence.name}</span>
                  <ArrowUpRight size={12} strokeWidth={1.75} className="text-subtle opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}
        <EntityListsSection entityType="person" entityId={contact.id} lists={lists} />
      </div>
    </aside>
  );
}

function SidePanelSection({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between px-1">
      <span className="text-[13px] font-medium">{title}</span>
      <button className="text-subtle hover:text-foreground transition-colors">
        <Plus size={15} strokeWidth={1.75} />
      </button>
    </div>
  );
}
