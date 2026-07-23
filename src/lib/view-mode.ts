"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "crm:viewMode";

export type ViewMode = "simple" | "advanced";

export function getViewMode(): ViewMode {
  if (typeof window === "undefined") return "simple";
  return localStorage.getItem(STORAGE_KEY) === "advanced" ? "advanced" : "simple";
}

export function setViewMode(mode: ViewMode) {
  localStorage.setItem(STORAGE_KEY, mode);
  window.dispatchEvent(new Event("crm:viewmode-change"));
}

// Every /contacts/[id] link in the app should go through this — Simple View keeps the
// existing single-column contact page, Advanced View sends the same link to /lead/[id]'s
// 3-column layout instead. Call inside a component body (uses useViewMode) so links
// re-render when the mode changes live, not just on next page load.
export function useContactHref() {
  const mode = useViewMode();
  const base = mode === "advanced" ? "/lead" : "/contacts";
  return (personId: string, suffix = "") => `${base}/${personId}${suffix}`;
}

// Hook for components that need to react to the mode changing live (e.g. re-render links
// when the user flips the Settings > Layout toggle in another tab, or just toggled it and
// this component is still mounted). Listens for both the same-tab custom event (setViewMode)
// and the storage event (other tabs).
export function useViewMode(): ViewMode {
  const [mode, setMode] = useState<ViewMode>("simple");

  useEffect(() => {
    setMode(getViewMode());
    function onChange() {
      setMode(getViewMode());
    }
    window.addEventListener("crm:viewmode-change", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("crm:viewmode-change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return mode;
}
