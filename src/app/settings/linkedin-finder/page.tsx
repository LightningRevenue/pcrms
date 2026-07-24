import { auth } from "@/lib/auth";
import { SettingsHeader } from "@/components/settings-header";
import { RestrictedSettingsPage } from "@/components/restricted-settings-page";
import { LinkedinFinderPanel } from "@/components/linkedin-finder-panel";

export default async function LinkedinFinderPage() {
  const session = await auth();
  if (session?.user?.role !== "owner" && session?.user?.role !== "admin") {
    return <RestrictedSettingsPage crumbs={["Workspace", "LinkedIn Finder"]} requiredRole="admin" />;
  }

  return (
    <>
      <SettingsHeader crumbs={["Workspace", "LinkedIn Finder"]} />
      <div className="px-8 py-10 max-w-3xl">
        <h1 className="text-xl font-medium">LinkedIn Finder</h1>
        <p className="text-[13px] text-subtle mt-1">
          Search LinkedIn for prospects using your own session cookie and a residential proxy,
          then import the ones you want straight into Contacts.
        </p>

        <LinkedinFinderPanel />
      </div>
    </>
  );
}
