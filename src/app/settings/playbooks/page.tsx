import { auth } from "@/lib/auth";
import { listPlaybooks } from "@/lib/actions/playbooks";
import { PlaybooksView } from "@/components/playbooks-view";
import { RestrictedSettingsPage } from "@/components/restricted-settings-page";

export default async function PlaybooksPage() {
  const session = await auth();
  if (session?.user?.role !== "owner" && session?.user?.role !== "admin") {
    return <RestrictedSettingsPage crumbs={["Resources", "Playbook Templates"]} requiredRole="admin" />;
  }

  const playbooks = await listPlaybooks();

  return <PlaybooksView playbooks={playbooks} />;
}
