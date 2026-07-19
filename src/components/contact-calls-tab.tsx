import { Phone, PhoneMissed, PhoneOff, Clock } from "lucide-react";
import type { Call, User } from "@prisma/client";

type CallRow = Call & { createdBy: User | null };

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

export function ContactCallsTab({ calls }: { calls: CallRow[] }) {
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
              <audio controls preload="none" src={call.recordingUrl} className="w-full h-8 mt-2" />
            )}
          </div>
        );
      })}
    </div>
  );
}
