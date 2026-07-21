import { auth } from "@/lib/auth";
import { RestrictedAppPage } from "@/components/restricted-app-page";

export default async function MarketingInboxPlacementsPage() {
  const session = await auth();
  if (session?.user?.role !== "owner" && session?.user?.role !== "admin") {
    return <RestrictedAppPage message="Only workspace admins and the owner can access marketing. Contact your workspace owner if you need access." />;
  }

  return (
    <div className="px-8 py-10">
      <h1 className="text-xl font-medium">Inbox Placements</h1>
      <p className="text-[13px] text-subtle mt-2">Coming soon.</p>
    </div>
  );
}
