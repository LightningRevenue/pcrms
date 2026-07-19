import { Sidebar } from "@/components/sidebar";
import { AuthSessionProvider } from "@/components/session-provider";

// Every page in this group is behind auth (enforced in src/proxy.ts), but without a
// server-side per-request signal here Next.js was prerendering pages like /dashboards,
// /companies, /calendar etc. as static HTML at build time — served straight from cache,
// bypassing the middleware's session check on every subsequent request.
export const dynamic = "force-dynamic";

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
