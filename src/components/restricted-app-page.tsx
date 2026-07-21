import { Lock } from "lucide-react";

// For full app pages (sequences, workflows, marketing/*, or a single contact/deal/company
// a member doesn't own) — unlike RestrictedSettingsPage, these have no SettingsHeader chrome
// of their own, so this renders as the page's entire content, centered.
export function RestrictedAppPage({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 py-20">
      <div className="size-10 rounded-full bg-muted flex items-center justify-center">
        <Lock size={18} strokeWidth={1.75} className="text-subtle" />
      </div>
      <h1 className="text-[15px] font-medium mt-4">This page is restricted</h1>
      <p className="text-[13px] text-subtle mt-1.5 max-w-sm">{message}</p>
    </div>
  );
}
