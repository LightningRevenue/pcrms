"use client";

import { useState, useTransition } from "react";
import { Phone, PhoneMissed, PhoneOff, Clock, ChevronDown } from "lucide-react";
import type { Call, CallOpportunity, Opportunity, User } from "@prisma/client";
import { setCallDisposition, setCallOpportunities } from "@/lib/actions/calls";
import { CALL_DISPOSITIONS } from "@/lib/call-dispositions";

type CallRow = Call & { createdBy: User | null; opportunities: CallOpportunity[] };

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

function formatDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const STATUS_META: Record<string, { label: string; icon: typeof Phone; className: string }> = {
  initiated: { label: "Connecting…", icon: Clock, className: "text-subtle" },
  ringing: { label: "Ringing…", icon: Phone, className: "text-subtle" },
  "in-progress": { label: "In progress", icon: Phone, className: "text-accent" },
  completed: { label: "Completed", icon: Phone, className: "text-accent" },
  "no-answer": { label: "No answer", icon: PhoneMissed, className: "text-subtle" },
  busy: { label: "Busy", icon: PhoneMissed, className: "text-subtle" },
  failed: { label: "Failed", icon: PhoneOff, className: "text-red-400" },
};

export function ContactCallsTab({
  calls,
  personId,
  opportunities,
}: {
  calls: CallRow[];
  personId: string;
  opportunities: Opportunity[];
}) {
  if (calls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Phone size={24} strokeWidth={1.5} className="text-subtle" />
        <p className="text-[13px] text-subtle mt-3">No calls yet.</p>
        <p className="text-[12px] text-subtle mt-1">Use the Call button above to place one.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border border border-border rounded-md overflow-hidden">
      {calls.map((call) => {
        const meta = STATUS_META[call.status] ?? STATUS_META.initiated;
        const Icon = meta.icon;
        return (
          <div key={call.id} className="px-4 py-3">
            <div className="flex items-center gap-3">
              <Icon size={16} strokeWidth={1.75} className={`shrink-0 ${meta.className}`} />
              <span className="flex-1 min-w-0">
                <p className="text-[13px]">
                  {call.toNumber} · <span className={meta.className}>{meta.label}</span>
                </p>
                <p className="text-[12px] text-subtle">
                  {call.createdBy?.name ?? call.createdBy?.email ?? "Unknown"} · {relativeTime(call.startedAt)}
                  {call.durationSec ? ` · ${formatDuration(call.durationSec)}` : ""}
                </p>
              </span>
            </div>
            {call.recordingUrl && (
              <audio controls preload="none" src={`/api/twilio/recordings/${call.id}`} className="w-full h-8 mt-2" />
            )}
            <div className="flex items-center gap-2 mt-2">
              <DispositionPicker call={call} personId={personId} />
              <OpportunityPicker call={call} personId={personId} opportunities={opportunities} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DispositionPicker({ call, personId }: { call: CallRow; personId: string }) {
  const [pending, startTransition] = useTransition();
  const current = CALL_DISPOSITIONS.find((d) => d.value === call.disposition);

  return (
    <select
      value={call.disposition ?? ""}
      disabled={pending}
      onChange={(e) => {
        const value = e.target.value || null;
        startTransition(() => setCallDisposition(call.id, value as (typeof CALL_DISPOSITIONS)[number]["value"] | null, personId));
      }}
      className="px-2 py-1 rounded border border-border text-[12px] bg-transparent outline-none disabled:opacity-50"
    >
      <option value="" className="bg-background text-foreground">
        {current ? current.label : "Set outcome…"}
      </option>
      {CALL_DISPOSITIONS.map((d) => (
        <option key={d.value} value={d.value} className="bg-background text-foreground">
          {d.label}
        </option>
      ))}
    </select>
  );
}

function OpportunityPicker({
  call,
  personId,
  opportunities,
}: {
  call: CallRow;
  personId: string;
  opportunities: Opportunity[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const linkedIds = new Set(call.opportunities.map((o) => o.opportunityId));

  if (opportunities.length === 0) return null;

  function toggle(opportunityId: string) {
    const next = linkedIds.has(opportunityId)
      ? [...linkedIds].filter((id) => id !== opportunityId)
      : [...linkedIds, opportunityId];
    startTransition(() => setCallOpportunities(call.id, next, personId));
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        className="flex items-center gap-1 px-2 py-1 rounded border border-border text-[12px] text-subtle hover:text-foreground transition-colors disabled:opacity-50"
      >
        {linkedIds.size > 0 ? `${linkedIds.size} deal${linkedIds.size > 1 ? "s" : ""}` : "Link deal"}
        <ChevronDown size={12} strokeWidth={1.75} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 w-52 border border-border rounded-lg bg-surface shadow-lg z-20 py-1 max-h-56 overflow-y-auto">
            {opportunities.map((o) => (
              <label key={o.id} className="flex items-center gap-2 px-3 py-1.5 text-[12px] hover:bg-muted transition-colors cursor-pointer">
                <input type="checkbox" checked={linkedIds.has(o.id)} onChange={() => toggle(o.id)} />
                <span className="truncate">{o.name || "Untitled"}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
