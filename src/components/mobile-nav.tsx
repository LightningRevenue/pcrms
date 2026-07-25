"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Inbox, Users, KanbanSquare, CheckSquare } from "lucide-react";

const TABS = [
  { href: "/m", label: "Home", icon: Home },
  { href: "/m/inbox", label: "Inbox", icon: Inbox },
  { href: "/m/contacts", label: "Contacts", icon: Users },
  { href: "/m/deals", label: "Deals", icon: KanbanSquare },
  { href: "/m/tasks", label: "Tasks", icon: CheckSquare },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 h-16 border-t border-border bg-surface flex items-stretch z-50">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = href === "/m" ? pathname === "/m" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] transition-colors ${
              active ? "text-accent font-semibold" : "text-subtle"
            }`}
          >
            <Icon size={20} strokeWidth={active ? 2 : 1.5} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
