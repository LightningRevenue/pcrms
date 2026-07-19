"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Mail, Phone, Building2, Clock } from "lucide-react";
import type { Contact, ContactStatus } from "@/lib/mock-data";

const STATUS_DOT: Record<ContactStatus, string> = {
  Lead: "bg-amber-400",
  Active: "bg-blue-400",
  Customer: "bg-emerald-400",
  Churned: "bg-zinc-300",
};

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function ContactHoverCard({
  contact,
  children,
}: {
  contact: Contact;
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimers() {
    if (showTimer.current) clearTimeout(showTimer.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }

  function scheduleShow() {
    clearTimers();
    showTimer.current = setTimeout(() => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (rect) setPos({ x: rect.left, y: rect.bottom + 6 });
    }, 250);
  }

  function scheduleHide() {
    clearTimers();
    hideTimer.current = setTimeout(() => setPos(null), 150);
  }

  return (
    <span
      ref={anchorRef}
      className="flex flex-1 min-w-0"
      onMouseEnter={scheduleShow}
      onMouseLeave={scheduleHide}
    >
      {children}
      {pos && (
        <div
          className="fixed z-50 w-64 border border-border rounded-lg bg-surface shadow-xl shadow-black/40 p-3.5"
          style={{ left: pos.x, top: pos.y }}
          onMouseEnter={clearTimers}
          onMouseLeave={scheduleHide}
        >
          <div className="flex items-center gap-2.5">
            <div className="size-9 shrink-0 rounded-full bg-muted border border-border flex items-center justify-center text-[12px] font-medium text-subtle">
              {initials(contact.name)}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-medium leading-tight truncate">{contact.name}</p>
              <span className="flex items-center gap-1.5 text-[12px] text-subtle mt-0.5">
                <span className={`size-1.5 rounded-full ${STATUS_DOT[contact.status]}`} />
                {contact.status}
              </span>
            </div>
          </div>

          <div className="mt-3 space-y-1.5 text-[12px] text-subtle">
            <div className="flex items-center gap-2 truncate">
              <Mail size={13} strokeWidth={1.75} className="shrink-0" />
              <span className="truncate">{contact.email}</span>
            </div>
            <div className="flex items-center gap-2 truncate">
              <Phone size={13} strokeWidth={1.75} className="shrink-0" />
              <span className="truncate">{contact.phone}</span>
            </div>
            <div className="flex items-center gap-2 truncate">
              <Building2 size={13} strokeWidth={1.75} className="shrink-0" />
              <span className="truncate">{contact.company}</span>
            </div>
            <div className="flex items-center gap-2 truncate">
              <Clock size={13} strokeWidth={1.75} className="shrink-0" />
              <span className="truncate">{contact.nextActivity}</span>
            </div>
          </div>

          <Link
            href={`/contacts/${contact.id}`}
            onClick={() => setPos(null)}
            className="mt-3 block w-full text-center px-2.5 py-1.5 rounded-md bg-foreground text-background text-[12px] font-medium hover:opacity-90 transition-opacity"
          >
            View contact
          </Link>
        </div>
      )}
    </span>
  );
}
