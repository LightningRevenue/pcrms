"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Home,
  Users,
  Building2,
  KanbanSquare,
  CheckSquare,
  FileText,
  LayoutGrid,
  CalendarDays,
  Workflow,
  GitBranch,
  PanelLeft,
  PanelLeftClose,
  MessageCirclePlus,
  ChevronDown,
  LogOut,
  Settings,
  Heart,
  User as PersonIcon,
  Banknote,
  X,
  Inbox,
  Megaphone,
  MailCheck,
  List,
} from "lucide-react";
import { WorkspaceSearch } from "@/components/workspace-search";
import { NotificationBell } from "@/components/notification-bell";
import { NAV_ITEMS, SIDEBAR_LAYOUT_EVENT, defaultLayout, loadLayout } from "@/lib/sidebar-nav";
import { listFavorites, removeFavorite } from "@/lib/actions/favorites";
import { FAVORITES_CHANGED_EVENT, notifyFavoritesChanged } from "@/lib/favorites-event";
import type { Favorite } from "@prisma/client";

const ICONS: Record<string, typeof Building2> = {
  inbox: Inbox,
  companies: Building2,
  contacts: Users,
  deals: KanbanSquare,
  calendar: CalendarDays,
  tasks: CheckSquare,
  notes: FileText,
  dashboards: LayoutGrid,
  workflows: Workflow,
  sequences: GitBranch,
};

const COLORS: Record<string, string> = {
  inbox: "text-sky-400",
  companies: "text-blue-400",
  contacts: "text-violet-400",
  deals: "text-rose-400",
  calendar: "text-orange-400",
  tasks: "text-emerald-400",
  notes: "text-slate-400",
  dashboards: "text-cyan-400",
};

const FAVORITE_ICONS: Record<string, typeof Building2> = {
  company: Building2,
  person: PersonIcon,
  opportunity: Banknote,
};

const MARKETING_NAV = [
  { key: "marketing-campaigns", href: "/marketing/campaigns", label: "Campaigns", icon: Megaphone, color: "text-pink-400" },
  { key: "marketing-dashboard", href: "/marketing/dashboard", label: "Dashboard", icon: LayoutGrid, color: "text-cyan-400" },
  { key: "marketing-inbox-placements", href: "/marketing/inbox-placements", label: "Inbox Placements", icon: MailCheck, color: "text-emerald-400" },
];

function useFavorites() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  useEffect(() => {
    let cancelled = false;
    function refresh() {
      listFavorites().then((list) => {
        if (!cancelled) setFavorites(list);
      });
    }
    refresh();
    window.addEventListener(FAVORITES_CHANGED_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(FAVORITES_CHANGED_EVENT, refresh);
    };
  }, []);

  return favorites;
}

function useOrderedNav() {
  // Init identical on server and client (defaultLayout) — loadLayout() reads
  // localStorage, which would otherwise desync the client's first render from
  // the server-rendered markup and trigger a hydration mismatch.
  const [layout, setLayout] = useState(defaultLayout);

  useEffect(() => {
    setLayout(loadLayout());
    const onChange = () => setLayout(loadLayout());
    window.addEventListener(SIDEBAR_LAYOUT_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(SIDEBAR_LAYOUT_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const byKey = new Map(NAV_ITEMS.map((i) => [i.key, i]));
  const ordered = layout
    .filter((l) => !l.hidden)
    .map((l) => byKey.get(l.key))
    .filter((i): i is (typeof NAV_ITEMS)[number] => !!i);
  return {
    main: ordered.filter((i) => i.section === "main"),
    automation: ordered.filter((i) => i.section === "automation"),
  };
}

function NavLink({
  href,
  label,
  icon: Icon,
  color,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  color?: string;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
        collapsed ? "justify-center px-0" : "px-2.5"
      } ${active ? "bg-muted text-foreground font-medium" : "text-subtle hover:bg-muted hover:text-foreground"}`}
    >
      <Icon size={16} strokeWidth={1.75} className={`shrink-0 ${color ?? ""}`} />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { main: NAV, automation: AUTOMATION_NAV } = useOrderedNav();
  const favorites = useFavorites();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`shrink-0 border-r border-border flex flex-col h-screen sticky top-0 bg-background transition-[width] duration-200 ease-in-out overflow-hidden ${
        collapsed ? "w-14" : "w-60"
      }`}
    >
      <div className={`h-12 flex items-center shrink-0 ${collapsed ? "justify-center px-0" : "justify-between px-3"}`}>
        {!collapsed && (
          <button className="flex items-center gap-1.5 min-w-0 px-1 py-1 rounded-md hover:bg-muted transition-colors">
            <span className="size-5 shrink-0 rounded bg-accent flex items-center justify-center text-[11px] font-semibold text-white">
              L
            </span>
            <span className="text-[13px] font-medium truncate">LightningRev...</span>
            <ChevronDown size={14} strokeWidth={1.75} className="text-subtle shrink-0" />
          </button>
        )}
        <div className={`flex items-center gap-0.5 shrink-0 ${collapsed ? "flex-col gap-1.5" : ""}`}>
          {!collapsed && <NotificationBell />}
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="p-1.5 rounded-md text-subtle hover:bg-muted hover:text-foreground transition-colors"
          >
            {collapsed ? (
              <PanelLeft size={15} strokeWidth={1.75} />
            ) : (
              <PanelLeftClose size={15} strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="px-3 pt-1 pb-3 space-y-1.5">
          <button className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border text-[13px] text-subtle hover:bg-muted hover:text-foreground transition-colors">
            <MessageCirclePlus size={15} strokeWidth={1.75} />
            New chat
          </button>
          <WorkspaceSearch />
        </div>
      )}

      {favorites.length > 0 && (
        <div className={collapsed ? "px-2 pt-1" : "px-2 pt-1"}>
          {!collapsed && (
            <p className="px-1 pb-1 text-[11px] font-medium text-subtle uppercase tracking-wide">
              Favorites
            </p>
          )}
          <div className="space-y-0.5">
            {favorites.map((f) => {
              const Icon = FAVORITE_ICONS[f.entityType] ?? Heart;
              const active = pathname === f.href || pathname.startsWith(`${f.href}/`);
              return (
                <div key={f.id} className="group relative">
                  <Link
                    href={f.href}
                    title={collapsed ? f.name : undefined}
                    className={`flex items-center gap-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
                      collapsed ? "justify-center px-0" : "px-2.5"
                    } ${active ? "bg-muted text-foreground font-medium" : "text-subtle hover:bg-muted hover:text-foreground"}`}
                  >
                    <Icon size={16} strokeWidth={1.75} className="shrink-0 text-rose-400" />
                    {!collapsed && <span className="flex-1 min-w-0 truncate">{f.name}</span>}
                  </Link>
                  {!collapsed && (
                    <button
                      onClick={() => removeFavorite(f.id).then(notifyFavoritesChanged)}
                      title="Remove from favorites"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-subtle opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity"
                    >
                      <X size={12} strokeWidth={1.75} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {!collapsed && (
          <div className="px-3 pb-1 pt-2">
            <span className="text-[11px] font-medium text-subtle uppercase tracking-wide">
              Workspace
            </span>
          </div>
        )}
        <nav className={`space-y-0.5 ${collapsed ? "px-2 pt-2" : "px-2"}`}>
          <NavLink
            href="/"
            label="Home"
            icon={Home}
            color="text-subtle"
            active={pathname === "/"}
            collapsed={collapsed}
          />

          {NAV.map(({ key, href, label }) => (
            <NavLink
              key={key}
              href={href}
              label={label}
              icon={ICONS[key]}
              color={COLORS[key]}
              active={pathname === href || pathname.startsWith(`${href}/`)}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {AUTOMATION_NAV.length > 0 && (
          <>
            {!collapsed && (
              <div className="px-3 pb-1 pt-3">
                <span className="text-[11px] font-medium text-subtle uppercase tracking-wide">
                  Automation
                </span>
              </div>
            )}
            <nav className={`space-y-0.5 ${collapsed ? "px-2 pt-1.5" : "px-2"}`}>
              {AUTOMATION_NAV.map(({ key, href, label }) => (
                <NavLink
                  key={key}
                  href={href}
                  label={label}
                  icon={ICONS[key]}
                  color="text-amber-400"
                  active={pathname === href || pathname.startsWith(`${href}/`)}
                  collapsed={collapsed}
                />
              ))}
            </nav>
          </>
        )}

        {!collapsed && (
          <div className="px-3 pb-1 pt-3">
            <span className="text-[11px] font-medium text-subtle uppercase tracking-wide">
              Marketing
            </span>
          </div>
        )}
        <nav className={`space-y-0.5 ${collapsed ? "px-2 pt-1.5" : "px-2"}`}>
          {MARKETING_NAV.map(({ key, href, label, icon, color }) => (
            <NavLink
              key={key}
              href={href}
              label={label}
              icon={icon}
              color={color}
              active={pathname === href || pathname.startsWith(`${href}/`)}
              collapsed={collapsed}
            />
          ))}
          <NavLink
            href="/lists"
            label="Lists"
            icon={List}
            color="text-subtle"
            active={pathname === "/lists" || pathname.startsWith("/lists/")}
            collapsed={collapsed}
          />
        </nav>
      </div>

      <div className={collapsed ? "px-2 pb-1" : "px-2 pb-1"}>
        <NavLink
          href="/settings"
          label="Settings"
          icon={Settings}
          color="text-subtle"
          active={pathname === "/settings" || pathname.startsWith("/settings/")}
          collapsed={collapsed}
        />
      </div>

      {session?.user && (
        <div
          className={`py-2.5 border-t border-border flex items-center gap-2 shrink-0 ${
            collapsed ? "px-2 justify-center" : "px-3"
          }`}
        >
          <span
            title={collapsed ? (session.user.name ?? session.user.email ?? undefined) : undefined}
            className="size-6 shrink-0 rounded-full bg-accent flex items-center justify-center text-[11px] font-semibold text-white"
          >
            {session.user.name?.[0] ?? session.user.email?.[0] ?? "?"}
          </span>
          {!collapsed && (
            <>
              <span className="text-[13px] truncate flex-1 min-w-0">
                {session.user.name ?? session.user.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="p-1.5 rounded-md text-subtle hover:bg-muted hover:text-foreground transition-colors"
                title="Sign out"
              >
                <LogOut size={15} strokeWidth={1.75} />
              </button>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
