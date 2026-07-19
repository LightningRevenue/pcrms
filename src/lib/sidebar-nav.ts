export type NavItem = {
  key: string;
  href: string;
  label: string;
  section: "main" | "automation";
};

export const NAV_ITEMS: NavItem[] = [
  { key: "inbox", href: "/inbox", label: "Unified Inbox", section: "main" },
  { key: "companies", href: "/companies", label: "Companies", section: "main" },
  { key: "contacts", href: "/contacts", label: "People", section: "main" },
  { key: "deals", href: "/deals", label: "Opportunities", section: "main" },
  { key: "calendar", href: "/calendar", label: "Calendar", section: "main" },
  { key: "tasks", href: "/tasks", label: "Tasks", section: "main" },
  { key: "notes", href: "/notes", label: "Notes", section: "main" },
  { key: "dashboards", href: "/dashboards", label: "Dashboards", section: "main" },
  { key: "workflows", href: "/workflows", label: "Workflows Builder", section: "automation" },
  { key: "sequences", href: "/sequences", label: "Sequence Builder", section: "automation" },
];

export const SIDEBAR_LAYOUT_KEY = "sidebar:layout";
export const SIDEBAR_LAYOUT_EVENT = "sidebar-layout-change";

export type SidebarLayout = { key: string; hidden: boolean }[];

export function defaultLayout(): SidebarLayout {
  return NAV_ITEMS.map((item) => ({ key: item.key, hidden: false }));
}

export function loadLayout(): SidebarLayout {
  if (typeof window === "undefined") return defaultLayout();
  try {
    const stored = JSON.parse(localStorage.getItem(SIDEBAR_LAYOUT_KEY) ?? "null") as SidebarLayout | null;
    if (!stored) return defaultLayout();
    const known = new Set(NAV_ITEMS.map((i) => i.key));
    const kept = stored.filter((s) => known.has(s.key));
    const missing = NAV_ITEMS.filter((i) => !kept.some((s) => s.key === i.key)).map((i) => ({
      key: i.key,
      hidden: false,
    }));
    return [...kept, ...missing];
  } catch {
    return defaultLayout();
  }
}

export function saveLayout(layout: SidebarLayout) {
  localStorage.setItem(SIDEBAR_LAYOUT_KEY, JSON.stringify(layout));
  window.dispatchEvent(new Event(SIDEBAR_LAYOUT_EVENT));
}
