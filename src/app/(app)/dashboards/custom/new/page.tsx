"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createCustomDashboard } from "@/lib/actions/custom-dashboards";

export default function NewCustomDashboardPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      try {
        const dashboard = await createCustomDashboard(name);
        router.push(`/dashboards/custom/${dashboard.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create dashboard");
      }
    });
  }

  return (
    <div className="px-8 py-10 max-w-md">
      <Link href="/dashboards" className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors">
        <ArrowLeft size={14} strokeWidth={1.75} />
        Dashboards
      </Link>

      <h1 className="text-xl font-medium mt-4">New dashboard</h1>
      <p className="text-[13px] text-subtle mt-1">Give it a name — add widgets on the next page.</p>

      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        placeholder="Dashboard name"
        className="mt-6 w-full px-3 py-2 rounded-md border border-border text-[13px] outline-none focus:border-accent transition-colors bg-transparent"
      />

      {error && <p className="text-[12px] text-red-400 mt-2">{error}</p>}

      <button
        onClick={handleCreate}
        disabled={pending || !name.trim()}
        className="mt-4 px-4 py-1.5 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create dashboard"}
      </button>
    </div>
  );
}
