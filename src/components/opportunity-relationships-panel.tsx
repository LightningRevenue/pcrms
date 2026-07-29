"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Building2, Plus, X, ArrowUpRight, User, Star } from "lucide-react";
import type { Company, List, OpportunityPerson, Person } from "@prisma/client";
import { CompanyLogo } from "@/components/company-logo";
import { EntityListsSection } from "@/components/entity-lists-section";
import {
  searchPeopleToLink,
  linkPersonToOpportunity,
  unlinkPersonFromOpportunity,
  setOpportunityPersonRole,
} from "@/lib/actions/relationships";
import { useContactHref } from "@/lib/view-mode";

type StakeholderLink = OpportunityPerson & { person: Person & { company: Company | null } };

// Free-text on the join row, but reps pick from the same short list 95% of the time.
const ROLES = ["Champion", "Economic Buyer", "Decision Maker", "Influencer", "Blocker", "Other"];

function personName(person: Pick<Person, "firstName" | "lastName">) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ");
}

function SectionHeader({ title, onAdd, addTitle }: { title: string; onAdd: () => void; addTitle: string }) {
  return (
    <div className="flex items-center justify-between px-1">
      <span className="text-[13px] font-medium">{title}</span>
      <button onClick={onAdd} className="text-subtle hover:text-foreground transition-colors" title={addTitle}>
        <Plus size={15} strokeWidth={1.75} />
      </button>
    </div>
  );
}

// Mirrors LeadRelationshipsPanel — the deal's third column. Stakeholders are the reason it
// exists: OpportunityPerson has been linkable from the lead page since it shipped, but the
// deal itself never showed who's involved.
export function OpportunityRelationshipsPanel({
  opportunityId,
  company,
  primaryContact,
  stakeholders,
  lists,
}: {
  opportunityId: string;
  company: Company | null;
  primaryContact: Person | null;
  stakeholders: StakeholderLink[];
  lists: List[];
}) {
  return (
    <aside className="w-80 shrink-0 border-l border-border h-full overflow-y-auto px-5 py-6 space-y-6">
      <CompanySection company={company} />
      <Stakeholders
        opportunityId={opportunityId}
        primaryContact={primaryContact}
        links={stakeholders}
      />
      <EntityListsSection entityType="opportunity" entityId={opportunityId} lists={lists} />
    </aside>
  );
}

function CompanySection({ company }: { company: Company | null }) {
  return (
    <div>
      <p className="text-[13px] font-medium px-1">Company</p>
      {company ? (
        <Link
          href={`/companies/${company.id}`}
          className="flex items-center gap-1.5 px-1 py-1 mt-1.5 rounded-md text-[13px] hover:bg-muted transition-colors group"
        >
          <CompanyLogo domain={company.domain} fallbackText="" size={14} className="bg-transparent border-0" />
          {!company.domain && <Building2 size={13} strokeWidth={1.75} className="text-subtle shrink-0" />}
          <span className="truncate flex-1 min-w-0">{company.name}</span>
          <ArrowUpRight
            size={12}
            strokeWidth={1.75}
            className="text-subtle opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          />
        </Link>
      ) : (
        <p className="px-1 py-1 mt-1.5 text-[12px] text-subtle">No company on this deal.</p>
      )}
    </div>
  );
}

function Stakeholders({
  opportunityId,
  primaryContact,
  links,
}: {
  opportunityId: string;
  primaryContact: Person | null;
  links: StakeholderLink[];
}) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const contactHref = useContactHref();

  // The primary contact is shown from Opportunity.contactId, so hide the join row that
  // duplicates them — otherwise they appear twice once someone links them explicitly.
  const others = links.filter((l) => l.personId !== primaryContact?.id);
  const primaryLink = links.find((l) => l.personId === primaryContact?.id);

  return (
    <div>
      <SectionHeader title="People" onAdd={() => setAdding((v) => !v)} addTitle="Link a person" />

      {adding && (
        <div className="mt-1.5">
          <PersonLinkSearch
            excludeIds={links.map((l) => l.personId)}
            onPick={(personId) => {
              startTransition(() => linkPersonToOpportunity(personId, opportunityId));
              setAdding(false);
            }}
          />
        </div>
      )}

      <div className="mt-1.5 space-y-0.5">
        {primaryContact && (
          <div className="flex items-center rounded-md hover:bg-muted transition-colors group">
            <Link
              href={contactHref(primaryContact.id)}
              className="flex-1 min-w-0 flex items-center gap-1.5 px-1 py-1 text-[13px]"
            >
              <Star size={13} strokeWidth={1.75} className="text-amber-400 shrink-0" />
              <span className="truncate">{personName(primaryContact)}</span>
              <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-subtle shrink-0">
                {primaryLink?.role || "Primary"}
              </span>
              <ArrowUpRight
                size={12}
                strokeWidth={1.75}
                className="text-subtle opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              />
            </Link>
          </div>
        )}

        {others.length === 0 && !primaryContact && !adding && (
          <p className="px-1 py-1 text-[12px] text-subtle">No people linked.</p>
        )}

        {others.map((link) => (
          <div key={link.personId} className="group">
            <div className="flex items-center rounded-md hover:bg-muted transition-colors">
              <Link
                href={contactHref(link.personId)}
                className="flex-1 min-w-0 flex items-center gap-1.5 px-1 py-1 text-[13px]"
              >
                <User size={13} strokeWidth={1.75} className="text-subtle shrink-0" />
                <span className="truncate">{personName(link.person)}</span>
                <ArrowUpRight
                  size={12}
                  strokeWidth={1.75}
                  className="text-subtle opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                />
              </Link>
              <button
                onClick={() => startTransition(() => unlinkPersonFromOpportunity(link.personId, opportunityId))}
                disabled={pending}
                className="p-1 mr-0.5 rounded text-subtle opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity shrink-0 disabled:opacity-50"
                title="Unlink"
              >
                <X size={12} strokeWidth={1.75} />
              </button>
            </div>
            <div className="pl-[22px] pr-1 pb-1">
              <RoleSelect
                value={link.role ?? ""}
                onChange={(role) =>
                  startTransition(() => setOpportunityPersonRole(link.personId, opportunityId, role))
                }
              />
              {link.person.jobTitle && (
                <p className="text-[11px] text-subtle truncate mt-0.5">{link.person.jobTitle}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoleSelect({ value, onChange }: { value: string; onChange: (role: string) => void }) {
  return (
    <select
      value={ROLES.includes(value) || value === "" ? value : "Other"}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-transparent text-[11px] text-subtle outline-none cursor-pointer hover:text-foreground transition-colors"
    >
      <option value="" className="bg-background text-foreground">
        Set role…
      </option>
      {ROLES.map((r) => (
        <option key={r} value={r} className="bg-background text-foreground">
          {r}
        </option>
      ))}
    </select>
  );
}

function PersonLinkSearch({
  excludeIds,
  onPick,
}: {
  excludeIds: string[];
  onPick: (personId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { id: string; firstName: string; lastName: string | null; email: string | null }[]
  >([]);

  useEffect(() => {
    const handle = setTimeout(async () => setResults(await searchPeopleToLink(query)), 150);
    return () => clearTimeout(handle);
  }, [query]);

  const filtered = results.filter((p) => !excludeIds.includes(p.id));

  return (
    <div className="border border-border rounded-lg bg-surface shadow-sm py-1">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search people…"
        className="w-full px-3 py-1.5 text-[13px] bg-transparent outline-none border-b border-border placeholder:text-subtle"
      />
      <div className="max-h-48 overflow-y-auto">
        {filtered.map((p) => (
          <button
            key={p.id}
            onClick={() => onPick(p.id)}
            className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-muted transition-colors truncate"
          >
            {personName(p)}
            {p.email && <span className="text-subtle ml-1.5 text-[11px]">{p.email}</span>}
          </button>
        ))}
        {query.trim() && filtered.length === 0 && (
          <p className="px-3 py-1.5 text-[12px] text-subtle">No matches.</p>
        )}
      </div>
    </div>
  );
}
