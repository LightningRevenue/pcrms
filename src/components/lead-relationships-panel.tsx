"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Building2, Handshake, Plus, X, ArrowUpRight } from "lucide-react";
import type { Company, Opportunity, PersonCompany, OpportunityPerson } from "@prisma/client";
import { CompanyLogo } from "@/components/company-logo";
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

export function LeadRelationshipsPanel({
  personId,
  primaryCompanyId,
  companyLinks,
  opportunityLinks,
}: {
  personId: string;
  primaryCompanyId: string | null;
  companyLinks: CompanyLink[];
  opportunityLinks: OpportunityLink[];
}) {
  return (
    <aside className="w-80 shrink-0 border-l border-border h-[calc(100vh-3.5rem)] overflow-y-auto px-5 py-6 space-y-6">
      <RelatedCompanies personId={personId} primaryCompanyId={primaryCompanyId} links={companyLinks} />
      <RelatedOpportunities personId={personId} links={opportunityLinks} />
    </aside>
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
      <div className="flex items-center justify-between px-1">
        <span className="text-[13px] font-medium">Related Companies</span>
        <button
          onClick={() => setAdding((v) => !v)}
          className="text-subtle hover:text-foreground transition-colors"
          title="Link a company"
        >
          <Plus size={15} strokeWidth={1.75} />
        </button>
      </div>

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
      <div className="flex items-center justify-between px-1">
        <span className="text-[13px] font-medium">Related Deals</span>
        <button
          onClick={() => setAdding((v) => !v)}
          className="text-subtle hover:text-foreground transition-colors"
          title="Link a deal"
        >
          <Plus size={15} strokeWidth={1.75} />
        </button>
      </div>

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
          <p className="px-1 py-1 text-[12px] text-subtle">No additional deals linked.</p>
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
