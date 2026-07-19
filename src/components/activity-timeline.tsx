import { PlusCircle, Pencil, ArrowRightLeft, CheckSquare, Mail, UserMinus, Phone } from "lucide-react";
import type { User } from "@prisma/client";

export type ActivityEntry = {
  id: string;
  kind: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
  actor: User | null;
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

const ICONS: Record<string, typeof PlusCircle> = {
  created: PlusCircle,
  opportunity_created: PlusCircle,
  stage_changed: ArrowRightLeft,
  task_created: CheckSquare,
  task_completed: CheckSquare,
  email_sent: Mail,
  call_logged: Phone,
  person_removed: UserMinus,
  company_removed: UserMinus,
};

function describe(e: ActivityEntry, actor: string) {
  switch (e.kind) {
    case "created":
      return (
        <>
          was created by <span className="font-medium">{actor}</span>
        </>
      );
    case "opportunity_created":
      return (
        <>
          opportunity <span className="font-medium">{e.newValue}</span> created by{" "}
          <span className="font-medium">{actor}</span>
        </>
      );
    case "stage_changed":
      return (
        <>
          stage changed from <span className="text-subtle">{e.oldValue}</span> to{" "}
          <span className="font-medium">{e.newValue}</span> — <span className="font-medium">{actor}</span>
        </>
      );
    case "task_created":
      return (
        <>
          task <span className="font-medium">{e.newValue}</span> created by{" "}
          <span className="font-medium">{actor}</span>
        </>
      );
    case "task_completed":
      return (
        <>
          task <span className="font-medium">{e.newValue}</span> completed by{" "}
          <span className="font-medium">{actor}</span>
        </>
      );
    case "email_sent":
      return (
        <>
          email <span className="font-medium">{e.newValue}</span> sent by{" "}
          <span className="font-medium">{actor}</span>
        </>
      );
    case "call_logged":
      return (
        <>
          <span className="font-medium">{e.newValue}</span> by <span className="font-medium">{actor}</span>
        </>
      );
    case "person_removed":
      return (
        <>
          contact <span className="font-medium">{e.oldValue}</span> removed by{" "}
          <span className="font-medium">{actor}</span>
        </>
      );
    case "company_removed":
      return (
        <>
          company <span className="font-medium">{e.oldValue}</span> removed by{" "}
          <span className="font-medium">{actor}</span>
        </>
      );
    default:
      return (
        <>
          changed <span className="font-medium">{e.field}</span> from{" "}
          <span className="text-subtle">{e.oldValue || "empty"}</span> to{" "}
          <span className="font-medium">{e.newValue || "empty"}</span> —{" "}
          <span className="font-medium">{actor}</span>
        </>
      );
  }
}

export function ActivityTimeline({ events }: { events: ActivityEntry[] }) {
  if (events.length === 0) {
    return <p className="text-[13px] text-subtle px-1">No activity yet.</p>;
  }

  return (
    <div className="space-y-4">
      {events.map((e) => {
        const actor = e.actor?.name ?? e.actor?.email ?? "Someone";
        const Icon = ICONS[e.kind] ?? Pencil;
        return (
          <div key={e.id} className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-2.5">
              <Icon size={16} strokeWidth={1.75} className="text-subtle shrink-0 mt-0.5" />
              <p className="text-[13px] leading-snug">{describe(e, actor)}</p>
            </div>
            <span className="text-[12px] text-subtle shrink-0">{relativeTime(e.createdAt)}</span>
          </div>
        );
      })}
    </div>
  );
}
