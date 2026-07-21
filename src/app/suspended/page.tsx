import { signOut } from "@/lib/auth";

export default function SuspendedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm px-8 py-10 border border-border rounded-lg text-center">
        <h1 className="text-xl font-medium mb-1">Workspace suspended</h1>
        <p className="text-[13px] text-subtle">
          This workspace has been suspended. Contact support if you believe this is a mistake.
        </p>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="w-full mt-6 py-2.5 rounded-lg border border-border text-[13px] font-medium hover:bg-muted transition-colors"
          >
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}
