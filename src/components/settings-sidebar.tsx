"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  User,
  BookOpen,
  Mail,
  Calendar,
  Settings2,
  Database,
  LayoutGrid,
  Users,
  DollarSign,
  Plug,
  Grid3x3,
  Sparkles,
  Users2,
  LifeBuoy,
  FileText,
  LogOut,
  Clock,
  Radar,
  Upload,
  Target,
  Inbox,
  BellRing,
  Phone,
  BookOpenCheck,
  Trash2,
  ShieldCheck,
  MailCheck,
  MailSearch,
  UserSearch,
} from "lucide-react";

const SECTIONS = [
  {
    label: "User",
    items: [
      { href: "/settings", label: "Profile", icon: User },
      { href: "/settings/experience", label: "Experience", icon: BookOpen },
    ],
  },
  {
    label: "Accounts",
    items: [
      { href: "/settings/accounts/emails", label: "Emails", icon: Mail },
      { href: "/settings/accounts/calendars", label: "Calendars", icon: Calendar },
      { href: "/settings/accounts/outreach-inboxes", label: "Outreach Inboxes", icon: Inbox },
      { href: "/settings/accounts/twilio", label: "Twilio", icon: Phone },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/settings/general", label: "General", icon: Settings2 },
      { href: "/settings/data-model", label: "Data model", icon: Database },
      { href: "/settings/pipeline", label: "Pipeline", icon: Target },
      { href: "/settings/contacts-pipeline", label: "Contacts Pipeline", icon: Users2 },
      { href: "/settings/import", label: "Import", icon: Upload },
      { href: "/settings/email-verifier", label: "Email Verifier", icon: MailCheck },
      { href: "/settings/mail-verifier", label: "Mail Verifier", icon: MailSearch },
      { href: "/settings/linkedin-finder", label: "LinkedIn Finder", icon: UserSearch },
      { href: "/settings/layout", label: "Layout", icon: LayoutGrid },
      { href: "/settings/members", label: "Members", icon: Users },
      { href: "/settings/billing", label: "Billing", icon: DollarSign },
      { href: "/settings/gdpr", label: "GDPR", icon: ShieldCheck },
      { href: "/settings/mcp-apis", label: "MCP & APIs", icon: Plug },
      { href: "/settings/apps", label: "Apps", icon: Grid3x3 },
      { href: "/settings/ai", label: "AI", icon: Sparkles },
      { href: "/settings/cron-jobs", label: "Cron Jobs", icon: Clock },
      { href: "/settings/trash", label: "Trash", icon: Trash2 },
      { href: "/settings/tracking", label: "Email Tracking", icon: Radar },
      { href: "/settings/email-notifications", label: "Email Notifications", icon: BellRing },
    ],
  },
  {
    label: "Resources",
    items: [
      { href: "/settings/email-templates", label: "Email Templates", icon: FileText },
      { href: "/settings/playbooks", label: "Playbook Templates", icon: BookOpenCheck },
    ],
  },
  {
    label: "Other",
    items: [
      { href: "/settings/community", label: "Community", icon: Users2 },
      { href: "/settings/support", label: "Support", icon: LifeBuoy },
      { href: "/settings/documentation", label: "Documentation", icon: FileText },
    ],
  },
];

export function SettingsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r border-border flex flex-col h-screen sticky top-0 bg-background">
      <div className="h-12 flex items-center px-3">
        <Link
          href="/"
          className="flex items-center gap-2 px-1 py-1 rounded-md text-[13px] text-subtle hover:bg-muted hover:text-foreground transition-colors"
        >
          Settings
        </Link>
      </div>

      <nav className="flex-1 px-2 pb-2 space-y-4 overflow-y-auto">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="px-2.5 pb-1">
              <span className="text-[11px] font-medium text-subtle uppercase tracking-wide">
                {section.label}
              </span>
            </div>
            <div className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
                      active
                        ? "bg-muted text-foreground font-medium"
                        : "text-subtle hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon size={15} strokeWidth={1.75} />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-2 py-2 border-t border-border">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] text-subtle hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut size={15} strokeWidth={1.75} />
          Logout
        </button>
      </div>
    </aside>
  );
}
