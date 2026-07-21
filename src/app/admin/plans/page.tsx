import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/admin";
import { listPlans } from "@/lib/actions/plans";
import { PlanManager } from "@/components/plan-manager";

export default async function AdminPlansPage() {
  await requirePlatformAdmin();
  const plans = await listPlans();

  return (
    <div className="px-8 py-10 max-w-3xl mx-auto">
      <Link href="/admin" className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors">
        <ArrowLeft size={14} strokeWidth={1.75} />
        All workspaces
      </Link>

      <div className="mt-4">
        <h1 className="text-xl font-medium">Plans</h1>
        <p className="text-[13px] text-subtle mt-1">
          Every entitlement in the system shows up here automatically. Leave a limit blank for
          unlimited (count/monthly) or enabled (feature) — a plan only needs rows for what it
          actually restricts.
        </p>
      </div>

      <PlanManager plans={plans} />
    </div>
  );
}
