"use client";

import Link from "next/link";
import type { List, Opportunity, Person, PipelineStage } from "@prisma/client";
import { ArrowUpRight, Handshake, Users, X } from "lucide-react";
import { EntityListsSection } from "@/components/entity-lists-section";
import { LinkPersonPopover } from "@/components/link-person-popover";
import { unlinkPersonFromCompany } from "@/lib/actions/companies";
import { useContactHref } from "@/lib/view-mode";

// Company counterpart to LeadRelationshipsPanel — the third column holds what this account
// is connected to, so the left panel stays about the company's own fields.
export function CompanyRelationsPanel({
  companyId,
  people,
  opportunities,
  stages,
  lists,
}: {
  companyId: string;
  people: Person[];
  opportunities: Opportunity[];
  stages: PipelineStage[];
  lists: List[];
}) {
  const contactHref = useContactHref();
  const outcomeOf = new Map(stages.map((s) => [s.label, s.outcome]));
  const open = opportunities.filter((o) => (outcomeOf.get(o.stage) ?? "open") === "open");
  const closed = opportunities.filter((o) => (outcomeOf.get(o.stage) ?? "open") !== "open");

  return (
    <aside className="w-80 shrink-0 border-l border-border h-full overflow-y-auto px-5 py-6 space-y-6">
      <section>
        {/* px-1/py-1 mirrors FieldSection's header button so both columns start on the
            same baseline. */}
        <div className="flex items-center justify-between px-1 py-1">
          <p className="flex items-center gap-1.5 text-[13px] font-medium">
            <Users size={13} strokeWidth={1.75} className="text-subtle" />
            Contacts
            <span className="text-subtle font-normal">· {people.length}</span>
          </p>
          <LinkPersonPopover companyId={companyId} />
        </div>
        {people.length === 0 ? (
          <p className="text-[12px] text-subtle px-1 mt-1.5">No contacts at this company yet.</p>
        ) : (
          <div className="mt-1.5 space-y-0.5">
            {people.map((person) => {
              const name = [person.firstName, person.lastName].filter(Boolean).join(" ") || "Untitled";
              return (
                <div key={person.id} className="group flex items-center rounded-md hover:bg-muted transition-colors">
                  <Link href={contactHref(person.id)} className="flex-1 min-w-0 flex items-center gap-1.5 px-1 py-1">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] truncate">{name}</span>
                      {person.jobTitle && (
                        <span className="block text-[11.5px] text-subtle truncate">{person.jobTitle}</span>
                      )}
                    </span>
                    <ArrowUpRight
                      size={12}
                      strokeWidth={1.75}
                      className="text-subtle opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    />
                  </Link>
                  <button
                    onClick={() => unlinkPersonFromCompany(companyId, person.id)}
                    title="Unlink from this company"
                    className="p-1 mr-0.5 rounded text-subtle opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity shrink-0"
                  >
                    <X size={12} strokeWidth={1.75} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <p className="flex items-center gap-1.5 text-[13px] font-medium px-1">
          <Handshake size={13} strokeWidth={1.75} className="text-subtle" />
          Deals
          <span className="text-subtle font-normal">· {opportunities.length}</span>
        </p>
        {opportunities.length === 0 ? (
          <p className="text-[12px] text-subtle px-1 mt-1.5">No deals for this company yet.</p>
        ) : (
          <div className="mt-1.5 space-y-0.5">
            {[...open, ...closed].map((deal) => {
              const outcome = outcomeOf.get(deal.stage) ?? "open";
              return (
                <Link
                  key={deal.id}
                  href={`/deals/${deal.id}`}
                  className="group flex items-center gap-1.5 px-1 py-1 rounded-md hover:bg-muted transition-colors"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] truncate">{deal.name}</span>
                    <span className="flex items-center gap-1.5 text-[11.5px] text-subtle">
                      <span
                        className={`size-1.5 rounded-full shrink-0 ${
                          outcome === "won" ? "bg-emerald-500" : outcome === "lost" ? "bg-rose-500" : "bg-accent"
                        }`}
                      />
                      <span className="truncate">{deal.stage}</span>
                    </span>
                  </span>
                  <span className="text-[12px] shrink-0">
                    {new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: "EUR",
                      maximumFractionDigits: 0,
                    }).format(deal.value)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <EntityListsSection entityType="company" entityId={companyId} lists={lists} />
    </aside>
  );
}
