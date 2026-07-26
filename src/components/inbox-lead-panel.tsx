"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  X,
  Mail,
  Phone,
  Building2,
  Link2,
  ArrowUpRight,
  Briefcase,
  CheckSquare,
  StickyNote,
  UserCircle,
  CalendarDays,
} from "lucide-react";
import { getInboxLeadContext, type InboxLeadContext } from "@/lib/actions/inbox";
import { CompanyLogo } from "@/components/company-logo";
import { useContactHref } from "@/lib/view-mode";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function relativeTime(date: Date) {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 60) return `${Math.max(minutes, 1)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function SectionHeader({
  icon: Icon,
  label,
  count,
}: {
  icon: typeof Mail;
  label: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-1.5 px-1 pb-1.5 text-[11.5px] font-medium text-subtle uppercase tracking-wide">
      <Icon size={13} strokeWidth={1.75} />
      {label}
      {count !== undefined && <span className="text-subtle/70 normal-case font-normal">· {count}</span>}
    </div>
  );
}

function Row({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-1 py-1.5">
      <div className="flex items-center gap-2 w-[88px] shrink-0 text-[12.5px] text-subtle">
        <Icon size={13} strokeWidth={1.75} />
        {label}
      </div>
      <div className="flex-1 min-w-0 text-[12.5px] truncate">{children}</div>
    </div>
  );
}

/** Compact pipeline position for one deal — dots up to the current stage. */
function StageTrack({ stages, stage }: { stages: InboxLeadContext["stages"]; stage: string }) {
  const index = stages.findIndex((s) => s.label === stage);
  const current = stages[index];
  const tone =
    current?.outcome === "won"
      ? "bg-emerald-500"
      : current?.outcome === "lost"
        ? "bg-rose-500"
        : "bg-accent";
  return (
    <div className="flex items-center gap-1 mt-1.5" title={stage}>
      {stages.map((s, i) => (
        <span
          key={s.label}
          className={`h-1 flex-1 rounded-full ${i <= index && index >= 0 ? tone : "bg-border"}`}
        />
      ))}
    </div>
  );
}

export function InboxLeadPanel({ personId, onClose }: { personId: string; onClose: () => void }) {
  const [data, setData] = useState<InboxLeadContext | null>(null);
  const [loading, setLoading] = useState(true);
  const contactHref = useContactHref();

  useEffect(() => {
    let active = true;
    setLoading(true);
    getInboxLeadContext(personId)
      .then((result) => {
        if (active) setData(result);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [personId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const person = data?.person;
  const name = person ? [person.firstName, person.lastName].filter(Boolean).join(" ") : "";
  const openDeals = data?.opportunities.filter((o) => !o.closeDate) ?? [];
  const pipelineValue = openDeals.reduce((sum, o) => sum + o.value, 0);

  return (
    <aside className="w-[340px] shrink-0 border-l border-border bg-surface flex flex-col min-h-0">
      <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-border">
        <span className="text-[12.5px] font-medium text-subtle">Lead overview</span>
        <button onClick={onClose} className="text-subtle hover:text-foreground transition-colors">
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-[12.5px] text-subtle">Loading…</div>
      ) : !person ? (
        <div className="flex-1 flex items-center justify-center px-6 text-center text-[12.5px] text-subtle">
          This sender isn&apos;t linked to a CRM contact yet.
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 pt-4 pb-3.5 flex items-center gap-3 border-b border-border">
              {person.company?.domain ? (
                <CompanyLogo
                  domain={person.company.domain}
                  fallbackText={initials(name) || "?"}
                  size={38}
                  rounded="rounded-full"
                  className="text-[13px]"
                />
              ) : (
                <div className="size-[38px] shrink-0 rounded-full flex items-center justify-center text-[13px] font-medium bg-violet-500 text-white">
                  {initials(name) || "?"}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium truncate">{name || "Untitled"}</p>
                {person.jobTitle && <p className="text-[12px] text-subtle truncate">{person.jobTitle}</p>}
              </div>
            </div>

            {openDeals.length > 0 && (
              <div className="px-3 pt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border p-2.5 min-w-0">
                  <p className="text-[11px] text-subtle uppercase tracking-wide">Open pipeline</p>
                  <p className="mt-0.5 text-[14px] font-semibold truncate">{formatMoney(pipelineValue)}</p>
                </div>
                <div className="rounded-lg border border-border p-2.5 min-w-0">
                  <p className="text-[11px] text-subtle uppercase tracking-wide">Open deals</p>
                  <p className="mt-0.5 text-[14px] font-semibold">{openDeals.length}</p>
                </div>
              </div>
            )}

            <div className="px-3 py-3">
              {person.email && (
                <Row icon={Mail} label="Email">
                  {person.email}
                </Row>
              )}
              {person.phone && (
                <Row icon={Phone} label="Phone">
                  {person.phone}
                </Row>
              )}
              {person.company && (
                <Row icon={Building2} label="Company">
                  <Link
                    href={`/companies/${person.company.id}`}
                    className="inline-block px-2 py-0.5 rounded-md border border-border bg-muted text-foreground truncate max-w-full hover:bg-accent hover:text-white hover:border-accent transition-colors"
                  >
                    {person.company.name || "Untitled"}
                  </Link>
                </Row>
              )}
              {person.linkedin && (
                <Row icon={Link2} label="LinkedIn">
                  <a href={person.linkedin} target="_blank" rel="noreferrer" className="text-accent hover:underline truncate block">
                    {person.linkedin}
                  </a>
                </Row>
              )}
              <Row icon={UserCircle} label="Owner">
                {person.owner?.name ?? person.owner?.email ?? "Unassigned"}
              </Row>
              <Row icon={CalendarDays} label="Created">
                {formatDate(person.createdAt)}
              </Row>
            </div>

            <div className="px-3 pt-1 pb-3 border-t border-border">
              <SectionHeader icon={Briefcase} label="Deals" count={data.opportunities.length} />
              {data.opportunities.length === 0 ? (
                <p className="text-[12px] text-subtle px-1">No deals yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {data.opportunities.map((o) => (
                    <Link
                      key={o.id}
                      href={`/deals/${o.id}`}
                      className="block px-2 py-2 rounded-lg border border-border hover:border-accent transition-colors"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="text-[12.5px] font-medium truncate flex-1">{o.name}</span>
                        <span className="text-[12.5px] shrink-0">{formatMoney(o.value)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11.5px] text-subtle">
                        <span className="truncate">{o.stage}</span>
                        {o.expectedCloseDate && !o.closeDate && (
                          <span className="ml-auto shrink-0">exp. {formatDate(o.expectedCloseDate)}</span>
                        )}
                      </div>
                      <StageTrack stages={data.stages} stage={o.stage} />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="px-3 pt-1 pb-3 border-t border-border">
              <SectionHeader icon={CheckSquare} label="Open tasks" count={data.tasks.length} />
              {data.tasks.length === 0 ? (
                <p className="text-[12px] text-subtle px-1">No open tasks.</p>
              ) : (
                data.tasks.map((t) => (
                  <div key={t.id} className="px-1 py-1">
                    <p className="text-[12.5px] truncate">{t.title}</p>
                    {t.dueAt && <p className="text-[11px] text-subtle">{formatDate(t.dueAt)}</p>}
                  </div>
                ))
              )}
            </div>

            <div className="px-3 pt-1 pb-4 border-t border-border">
              <SectionHeader icon={StickyNote} label="Recent notes" count={data.notes.length} />
              {data.notes.length === 0 ? (
                <p className="text-[12px] text-subtle px-1">No notes yet.</p>
              ) : (
                data.notes.map((n) => (
                  <div key={n.id} className="px-1 py-1.5">
                    <p className="text-[12.5px] whitespace-pre-wrap break-words line-clamp-3">{n.body}</p>
                    <p className="text-[11px] text-subtle mt-0.5">
                      {n.createdBy?.name ?? n.createdBy?.email ?? "Unknown"} · {relativeTime(n.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="shrink-0 px-4 py-3 border-t border-border">
            <Link
              href={contactHref(person.id)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] border border-border hover:bg-muted transition-colors"
            >
              View full profile
              <ArrowUpRight size={13} strokeWidth={1.75} />
            </Link>
          </div>
        </>
      )}
    </aside>
  );
}
