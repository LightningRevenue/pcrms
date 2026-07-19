import { Sidebar } from "@/components/sidebar";
import { AuthSessionProvider } from "@/components/session-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthSessionProvider>
      <div className="min-h-full flex">
        <Sidebar />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </AuthSessionProvider>
  );
}
