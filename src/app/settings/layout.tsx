import { SettingsSidebar } from "@/components/settings-sidebar";
import { AuthSessionProvider } from "@/components/session-provider";

// See src/app/(app)/layout.tsx — same reasoning, these pages need the auth middleware
// to run on every request rather than being served from a static build-time cache.
export const dynamic = "force-dynamic";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthSessionProvider>
      <div className="min-h-full flex">
        <SettingsSidebar />
        <main className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto">{children}</main>
      </div>
    </AuthSessionProvider>
  );
}
