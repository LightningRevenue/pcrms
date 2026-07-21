import { Lock } from "lucide-react";
import { SettingsHeader } from "@/components/settings-header";

export function RestrictedSettingsPage({
  crumbs,
  requiredRole,
  message,
}: {
  crumbs: string[];
  requiredRole?: "owner" | "admin";
  message?: string;
}) {
  return (
    <>
      <SettingsHeader crumbs={crumbs} />
      <div className="px-8 py-10 max-w-2xl">
        <div className="flex flex-col items-center text-center border border-border rounded-lg py-12 px-8">
          <div className="size-10 rounded-full bg-muted flex items-center justify-center">
            <Lock size={18} strokeWidth={1.75} className="text-subtle" />
          </div>
          <h1 className="text-[15px] font-medium mt-4">This page is restricted</h1>
          <p className="text-[13px] text-subtle mt-1.5 max-w-sm">
            {message ??
              (requiredRole === "owner"
                ? "Only the workspace owner can access this. Contact your workspace owner if you need this changed."
                : "Only workspace admins and the owner can access this. Contact your workspace owner if you need access.")}
          </p>
        </div>
      </div>
    </>
  );
}
