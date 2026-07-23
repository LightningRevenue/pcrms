"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Building2, Handshake, Plus, X, ArrowUpRight, GitBranch } from "lucide-react";
import type { Company, List, Opportunity, PersonCompany, OpportunityPerson, Sequence, SequenceEnrollment, SequenceStep, SequenceStepRun } from "@prisma/client";
import { CompanyLogo } from "@/components/company-logo";
import { CompanyAutocompleteField } from "@/components/company-autocomplete-field";
import { EntityListsSection } from "@/components/entity-lists-section";
import { AddToSequencePanel } from "@/components/add-to-sequence-panel";
import { setPersonCompany } from "@/lib/actions/contacts";
import { searchCompanies } from "@/lib/actions/companies";
import {
  linkPersonToCompany,
  unlinkPersonFromCompany,
  searchOpportunitiesToLink,
  linkPersonToOpportunity,
  unlinkPersonFromOpportunity,
} from "@/lib/actions/relationships";

type CompanyLink = PersonCompany & { company: Company };
type OpportunityLink = OpportunityPerson & { opportunity: Opportunity };
type StepRunWithStep = SequenceStepRun & { step: SequenceStep };
type EnrollmentWithProgress = SequenceEnrollment & {
  sequence: Sequence;
  currentStep: StepRunWithStep | null;
};

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

export function LeadRelationshipsPanel({
  personId,
  primaryCompany,
  companyLinks,
  opportunityLinks,
  lists,
  sequenceEnrollments,
}: {
  personId: string;
  primaryCompany: Company | null;
  companyLinks: CompanyLink[];
  opportunityLinks: OpportunityLink[];
  lists: List[];
  sequenceEnrollments: EnrollmentWithProgress[];
}) {
  return (
    <aside className="w-80 shrink-0 border-l border-border h-[calc(100vh-3.5rem)] overflow-y-auto px-5 py-6 space-y-6">
      <MainCompany personId={personId} company={primaryCompany} />
      <RelatedCompanies personId={personId} primaryCompanyId={primaryCompany?.id ?? null} links={companyLinks} />
      <RelatedOpportunities personId={personId} links={opportunityLinks} />
      <EntityListsSection entityType="person" entityId={personId} lists={lists} />
      <SequenceEnrollments personId={personId} enrollments={sequenceEnrollments} />
    </aside>
  );
}

function MainCompany({ personId, company }: { personId: string; company: Company | null }) {
  return (
    <div>
      <p className="text-[13px] font-medium px-1">Main Company</p>
      {company ? (
        <div className="flex items-center rounded-md hover:bg-muted transition-colors mt-1.5 group">
          <Link
            href={`/companies/${company.id}`}
            className="flex-1 min-w-0 flex items-center gap-1.5 px-1 py-1 text-[13px]"
          >
            <CompanyLogo domain={company.domain} fallbackText="" size={14} className="bg-transparent border-0" />
            {!company.domain && <Building2 size={13} strokeWidth={1.75} className="text-subtle shrink-0" />}
            <span className="truncate">{company.name}</span>
            <ArrowUpRight size={12} strokeWidth={1.75} className="text-subtle opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </Link>
          <button
            onClick={() => setPersonCompany(personId, null)}
            className="p-1 mr-0.5 rounded text-subtle opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity shrink-0"
            title="Unlink"
          >
            <X size={12} strokeWidth={1.75} />
          </button>
        </div>
      ) : (
        <div className="mt-1.5">
          <CompanyAutocompleteField value="" onSelect={(c) => setPersonCompany(personId, c)} showLabel={false} />
        </div>
      )}
    </div>
  );
}

function RelatedCompanies({
  personId,
  primaryCompanyId,
  links,
}: {
  personId: string;
  primaryCompanyId: string | null;
  links: CompanyLink[];
}) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  function unlink(companyId: string) {
    startTransition(() => unlinkPersonFromCompany(personId, companyId));
  }

  return (
    <div>
      <SectionHeader title="Other Companies" onAdd={() => setAdding((v) => !v)} addTitle="Link a company" />

      {adding && (
        <div className="mt-1.5">
          <CompanyLinkSearch
            excludeIds={[primaryCompanyId, ...links.map((l) => l.companyId)].filter((id): id is string => !!id)}
            onPick={(companyId) => {
              startTransition(() => linkPersonToCompany(personId, companyId));
              setAdding(false);
            }}
          />
        </div>
      )}

      <div className="mt-1.5 space-y-0.5">
        {links.length === 0 && !adding && (
          <p className="px-1 py-1 text-[12px] text-subtle">No additional companies linked.</p>
        )}
        {links.map((link) => (
          <div
            key={link.companyId}
            className="flex items-center rounded-md hover:bg-muted transition-colors group"
          >
            <Link
              href={`/companies/${link.companyId}`}
              className="flex-1 min-w-0 flex items-center gap-1.5 px-1 py-1 text-[13px]"
            >
              <CompanyLogo domain={link.company.domain} fallbackText="" size={14} className="bg-transparent border-0" />
              {!link.company.domain && <Building2 size={13} strokeWidth={1.75} className="text-subtle shrink-0" />}
              <span className="truncate">{link.company.name}</span>
              {link.role && <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-subtle shrink-0">{link.role}</span>}
              <ArrowUpRight size={12} strokeWidth={1.75} className="text-subtle opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </Link>
            <button
              onClick={() => unlink(link.companyId)}
              disabled={pending}
              className="p-1 mr-0.5 rounded text-subtle opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity shrink-0 disabled:opacity-50"
              title="Unlink"
            >
              <X size={12} strokeWidth={1.75} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompanyLinkSearch({ excludeIds, onPick }: { excludeIds: string[]; onPick: (companyId: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; name: string }[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = setTimeout(async () => setResults(await searchCompanies(query)), 150);
    return () => clearTimeout(handle);
  }, [query]);

  const filtered = results.filter((c) => !excludeIds.includes(c.id));

  return (
    <div ref={ref} className="border border-border rounded-lg bg-surface shadow-sm py-1">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search companies…"
        className="w-full px-3 py-1.5 text-[13px] bg-transparent outline-none border-b border-border placeholder:text-subtle"
      />
      <div className="max-h-48 overflow-y-auto">
        {filtered.map((c) => (
          <button
            key={c.id}
            onClick={() => onPick(c.id)}
            className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-muted transition-colors truncate"
          >
            {c.name}
          </button>
        ))}
        {query.trim() && filtered.length === 0 && (
          <p className="px-3 py-1.5 text-[12px] text-subtle">No matches.</p>
        )}
      </div>
    </div>
  );
}

function RelatedOpportunities({ personId, links }: { personId: string; links: OpportunityLink[] }) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  function unlink(opportunityId: string) {
    startTransition(() => unlinkPersonFromOpportunity(personId, opportunityId));
  }

  return (
    <div>
      <SectionHeader title="Deals" onAdd={() => setAdding((v) => !v)} addTitle="Link a deal" />

      {adding && (
        <div className="mt-1.5">
          <OpportunityLinkSearch
            excludeIds={links.map((l) => l.opportunityId)}
            onPick={(opportunityId) => {
              startTransition(() => linkPersonToOpportunity(personId, opportunityId));
              setAdding(false);
            }}
          />
        </div>
      )}

      <div className="mt-1.5 space-y-0.5">
        {links.length === 0 && !adding && (
          <p className="px-1 py-1 text-[12px] text-subtle">No deals linked.</p>
        )}
        {links.map((link) => (
          <div
            key={link.opportunityId}
            className="flex items-center rounded-md hover:bg-muted transition-colors group"
          >
            <Link
              href={`/deals/${link.opportunityId}`}
              className="flex-1 min-w-0 flex items-center gap-1.5 px-1 py-1 text-[13px]"
            >
              <Handshake size={13} strokeWidth={1.75} className="text-subtle shrink-0" />
              <span className="truncate">{link.opportunity.name}</span>
              {link.role && <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-subtle shrink-0">{link.role}</span>}
              <ArrowUpRight size={12} strokeWidth={1.75} className="text-subtle opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </Link>
            <button
              onClick={() => unlink(link.opportunityId)}
              disabled={pending}
              className="p-1 mr-0.5 rounded text-subtle opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity shrink-0 disabled:opacity-50"
              title="Unlink"
            >
              <X size={12} strokeWidth={1.75} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function OpportunityLinkSearch({ excludeIds, onPick }: { excludeIds: string[]; onPick: (opportunityId: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const handle = setTimeout(async () => setResults(await searchOpportunitiesToLink(query)), 150);
    return () => clearTimeout(handle);
  }, [query]);

  const filtered = results.filter((o) => !excludeIds.includes(o.id));

  return (
    <div className="border border-border rounded-lg bg-surface shadow-sm py-1">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search deals…"
        className="w-full px-3 py-1.5 text-[13px] bg-transparent outline-none border-b border-border placeholder:text-subtle"
      />
      <div className="max-h-48 overflow-y-auto">
        {filtered.map((o) => (
          <button
            key={o.id}
            onClick={() => onPick(o.id)}
            className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-muted transition-colors truncate"
          >
            {o.name}
          </button>
        ))}
        {query.trim() && filtered.length === 0 && (
          <p className="px-3 py-1.5 text-[12px] text-subtle">No matches.</p>
        )}
      </div>
    </div>
  );
}

function stepLabel(step: SequenceStep) {
  if (step.type === "email") return `Step ${step.order + 1} · Email`;
  if (step.type === "task") return `Step ${step.order + 1} · Task${step.taskTitle ? `: ${step.taskTitle}` : ""}`;
  return `Step ${step.order + 1} · Note`;
}

function SequenceEnrollments({ personId, enrollments }: { personId: string; enrollments: EnrollmentWithProgress[] }) {
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <SectionHeader title="Sequences" onAdd={() => setAdding(true)} addTitle="Enroll in a sequence" />

      <div className="mt-1.5 space-y-2">
        {enrollments.length === 0 && <p className="px-1 py-1 text-[12px] text-subtle">Not enrolled in any sequence.</p>}
        {enrollments.map((e) => (
          <Link
            key={e.id}
            href={`/sequences/${e.sequenceId}`}
            className="block rounded-md px-1 py-1.5 hover:bg-muted transition-colors group"
          >
            <div className="flex items-center gap-1.5 text-[13px]">
              <GitBranch size={13} strokeWidth={1.75} className="text-subtle shrink-0" />
              <span className="truncate flex-1 min-w-0">{e.sequence.name}</span>
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded-full shrink-0 ${
                  e.status === "active"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : e.status === "completed"
                      ? "bg-muted text-subtle"
                      : "bg-red-500/10 text-red-400"
                }`}
              >
                {e.status}
              </span>
              <ArrowUpRight size={12} strokeWidth={1.75} className="text-subtle opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
            {e.status === "active" && (
              <p className="mt-0.5 pl-[19px] text-[12px] text-subtle truncate">
                {e.currentStep ? `Current: ${stepLabel(e.currentStep.step)}` : "Finishing up…"}
              </p>
            )}
          </Link>
        ))}
      </div>

      {adding && <AddToSequencePanel personId={personId} onClose={() => setAdding(false)} />}
    </div>
  );
}
