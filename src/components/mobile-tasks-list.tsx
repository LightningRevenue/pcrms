"use client";

import { useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Task, Person, Company, User } from "@prisma/client";
import { toggleTask } from "@/lib/actions/tasks";

type TaskRow = Task & { person: (Person & { company: Company | null }) | null; createdBy: User | null };

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function MobileTasksList({ tasks }: { tasks: TaskRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const groups = useMemo(() => {
    const today = startOfDay(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const open = tasks.filter((t) => !t.done);
    const overdue = open.filter((t) => t.dueAt && t.dueAt < today);
    const dueToday = open.filter((t) => t.dueAt && t.dueAt >= today && t.dueAt < tomorrow);
    const upcoming = open.filter((t) => t.dueAt && t.dueAt >= tomorrow);
    const done = tasks.filter((t) => t.done).slice(0, 20);

    return [
      { label: "Overdue", items: overdue },
      { label: "Today", items: dueToday },
      { label: "Upcoming", items: upcoming },
      { label: "Completed", items: done },
    ].filter((g) => g.items.length > 0);
  }, [tasks]);

  function toggle(id: string) {
    startTransition(async () => {
      await toggleTask(id);
      router.refresh();
    });
  }

  if (groups.length === 0) {
    return <div className="p-4 text-[13px] text-subtle">No tasks with a due date.</div>;
  }

  return (
    <div className="pb-4">
      {groups.map(({ label, items }) => (
        <div key={label}>
          <div className="sticky top-0 bg-background px-4 py-2 border-b border-border">
            <span className="text-[12px] font-bold text-subtle uppercase tracking-wider">{label}</span>
          </div>
          <div className="divide-y divide-border">
            {items.map((t) => (
              <div key={t.id} className="flex items-start gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  checked={t.done}
                  disabled={isPending}
                  onChange={() => toggle(t.id)}
                  className="mt-0.5 accent-[var(--accent)] shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-[13.5px] font-medium truncate ${t.done ? "line-through text-subtle" : ""}`}>
                    {t.title}
                  </p>
                  <div className="flex items-center gap-2 text-[12px] text-subtle">
                    {t.person && (
                      <Link href={`/m/contacts/${t.person.id}`} className="text-accent truncate">
                        {[t.person.firstName, t.person.lastName].filter(Boolean).join(" ")}
                      </Link>
                    )}
                    {t.dueAt && <span>{new Date(t.dueAt).toLocaleDateString()}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
