"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  Sun,
  Moon,
  Search,
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

const FAVORITE_ICONS: Record<string, typeof Building2> = {
  company: Building2,
  person: PersonIcon,
  opportunity: Banknote,
};

const MARKETING_NAV = [
  { key: "marketing-campaigns", href: "/marketing/campaigns", label: "Campaigns", icon: Megaphone },
  { key: "marketing-dashboard", href: "/marketing/dashboard", label: "Dashboard", icon: LayoutGrid },
  { key: "marketing-inbox-placements", href: "/marketing/inbox-placements", label: "Inbox Placements", icon: MailCheck },
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
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`group relative flex items-center gap-2.5 py-2 rounded-lg text-[13.5px] transition-colors ${
        collapsed ? "justify-center px-0" : "px-3"
      } ${
        active
          ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-accent font-bold"
          : "text-subtle hover:bg-muted hover:text-foreground font-medium"
      }`}
    >
      <span
        className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full bg-accent transition-all ${
          active ? "h-4 opacity-100" : "h-0 opacity-0 group-hover:h-2 group-hover:opacity-40"
        }`}
      />
      <Icon size={16} strokeWidth={active ? 2 : 1.5} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

const THEME_KEY = "theme";

function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    setTheme(stored === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    if (next === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  return { theme, toggle };
}

function useCollapsedSections() {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      setHidden(JSON.parse(localStorage.getItem("sidebar:sections") ?? "{}"));
    } catch {
      // ponytail: bad JSON → default all-open, no recovery needed
    }
  }, []);

  function toggle(key: string) {
    setHidden((h) => {
      const next = { ...h, [key]: !h[key] };
      localStorage.setItem("sidebar:sections", JSON.stringify(next));
      return next;
    });
  }

  return { hidden, toggle };
}

function SectionHeader({
  label,
  collapsed,
  onClick,
}: {
  label: string;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group w-full flex items-center gap-1 px-3 pb-1 pt-3 text-[10.5px] font-bold text-subtle uppercase tracking-wider hover:text-foreground transition-colors"
    >
      <span>{label}</span>
      <ChevronDown
        size={12}
        strokeWidth={2.5}
        className={`transition-transform opacity-0 group-hover:opacity-100 ${collapsed ? "-rotate-90" : ""}`}
      />
    </button>
  );
}

function WorkspaceMenu({ collapsed }: { collapsed: boolean }) {
  const { data: session } = useSession();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function openMenu() {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setRect({ top: r.bottom + 4, left: r.left });
    setOpen(true);
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => (open ? setOpen(false) : openMenu())}
        title={collapsed ? "Workspace menu" : undefined}
        className={`flex items-center gap-2 min-w-0 py-1 rounded-md hover:bg-muted transition-colors ${
          collapsed ? "justify-center px-0" : "px-1"
        }`}
      >
        <span className="size-6 shrink-0 rounded-xl flex items-center justify-center text-[12px] font-extrabold text-white shadow-sm bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent)_78%,white),var(--accent))]">
          {(session?.user?.workspaceName ?? "W")[0].toUpperCase()}
        </span>
        {!collapsed && (
          <>
            <span className="text-[14px] font-extrabold truncate">
              {session?.user?.workspaceName ?? "Workspace"}
            </span>
            <ChevronDown size={14} strokeWidth={2} className="text-subtle shrink-0" />
          </>
        )}
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={menuRef}
            style={{ top: rect.top, left: rect.left }}
            className="fixed w-48 rounded-lg border border-border bg-surface shadow-lg py-1 z-[100]"
          >
          {session?.user && (
            <div className="px-3 py-2 border-b border-border">
              <p className="text-[13px] font-bold truncate">{session.user.name ?? session.user.email}</p>
              {session.user.name && (
                <p className="text-[12px] text-subtle truncate">{session.user.email}</p>
              )}
            </div>
          )}
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-subtle hover:bg-muted hover:text-foreground transition-colors"
          >
            <Settings size={15} strokeWidth={1.5} />
            Settings
          </Link>
          <button
            onClick={toggle}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-subtle hover:bg-muted hover:text-foreground transition-colors"
          >
            {theme === "light" ? <Moon size={15} strokeWidth={1.5} /> : <Sun size={15} strokeWidth={1.5} />}
            {theme === "light" ? "Dark mode" : "Light mode"}
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-subtle hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut size={15} strokeWidth={1.5} />
            Log out
          </button>
          </div>,
          document.body
        )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { main: NAV, automation: AUTOMATION_NAV } = useOrderedNav();
  const favorites = useFavorites();
  const [collapsed, setCollapsed] = useState(false);
  const { hidden, toggle } = useCollapsedSections();

  return (
    <aside
      className={`shrink-0 border-r border-border flex flex-col h-screen sticky top-0 bg-background transition-[width] duration-200 ease-in-out ${
        collapsed ? "w-14" : "w-60"
      }`}
    >
      <div className={`h-14 flex items-center shrink-0 ${collapsed ? "justify-center px-0" : "justify-between px-3"}`}>
        <WorkspaceMenu collapsed={collapsed} />
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

      {!collapsed ? (
        <div className="px-3 pt-1 pb-3 space-y-1.5">
          <button className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border text-[13px] text-subtle hover:bg-muted hover:text-foreground transition-colors">
            <MessageCirclePlus size={15} strokeWidth={1.75} />
            New chat
          </button>
          <WorkspaceSearch />
        </div>
      ) : (
        <div className="px-2 pt-1 pb-2">
          <button
            onClick={() => setCollapsed(false)}
            title="Search (⌘K)"
            className="w-full flex justify-center py-2 rounded-lg text-subtle hover:bg-muted hover:text-foreground transition-colors"
          >
            <Search size={16} strokeWidth={1.75} />
          </button>
        </div>
      )}

      {favorites.length > 0 && (
        <div className={collapsed ? "px-2 pt-1" : "px-2 pt-1"}>
          {!collapsed && (
            <p className="px-1 pb-1 text-[10.5px] font-bold text-subtle uppercase tracking-wider">
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
                    className={`flex items-center gap-2.5 py-2 rounded-lg text-[13.5px] transition-colors ${
                      collapsed ? "justify-center px-0" : "px-3"
                    } ${
                      active
                        ? "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-accent font-bold"
                        : "text-subtle hover:bg-muted hover:text-foreground font-medium"
                    }`}
                  >
                    <Icon size={16} strokeWidth={1.5} className="shrink-0" />
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
        {!collapsed ? (
          <SectionHeader label="Workspace" collapsed={!!hidden.workspace} onClick={() => toggle("workspace")} />
        ) : (
          <div className="pt-2" />
        )}
        {/* first group has no divider above it */}
        {!(hidden.workspace && !collapsed) && (
          <nav className={`space-y-0.5 ${collapsed ? "px-2 pt-2" : "px-2"}`}>
            <NavLink
              href="/"
              label="Home"
              icon={Home}
              active={pathname === "/"}
              collapsed={collapsed}
            />

            {NAV.map(({ key, href, label }) => (
              <NavLink
                key={key}
                href={href}
                label={label}
                icon={ICONS[key]}
                active={pathname === href || pathname.startsWith(`${href}/`)}
                collapsed={collapsed}
              />
            ))}
          </nav>
        )}

        {AUTOMATION_NAV.length > 0 && (
          <>
            {!collapsed ? (
              <SectionHeader label="Automation" collapsed={!!hidden.automation} onClick={() => toggle("automation")} />
            ) : (
              <div className="mx-auto my-2 h-px w-6 bg-border" />
            )}
            {!(hidden.automation && !collapsed) && (
              <nav className={`space-y-0.5 ${collapsed ? "px-2 pt-1.5" : "px-2"}`}>
                {AUTOMATION_NAV.map(({ key, href, label }) => (
                  <NavLink
                    key={key}
                    href={href}
                    label={label}
                    icon={ICONS[key]}
                    active={pathname === href || pathname.startsWith(`${href}/`)}
                    collapsed={collapsed}
                  />
                ))}
              </nav>
            )}
          </>
        )}

        {!collapsed ? (
          <SectionHeader label="Marketing" collapsed={!!hidden.marketing} onClick={() => toggle("marketing")} />
        ) : (
          <div className="mx-auto my-2 h-px w-6 bg-border" />
        )}
        {!(hidden.marketing && !collapsed) && (
          <nav className={`space-y-0.5 ${collapsed ? "px-2 pt-1.5" : "px-2"}`}>
            {MARKETING_NAV.map(({ key, href, label, icon }) => (
              <NavLink
                key={key}
                href={href}
                label={label}
                icon={icon}
                active={pathname === href || pathname.startsWith(`${href}/`)}
                collapsed={collapsed}
              />
            ))}
            <NavLink
              href="/lists"
              label="Lists"
              icon={List}
              active={pathname === "/lists" || pathname.startsWith("/lists/")}
              collapsed={collapsed}
            />
          </nav>
        )}
      </div>
    </aside>
  );
}
