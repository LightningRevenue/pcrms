import { auth } from "@/lib/auth";
import { SequencesView } from "@/components/sequences-view";
import { RestrictedAppPage } from "@/components/restricted-app-page";
import { listSequences } from "@/lib/actions/sequences";

export default async function SequencesPage() {
  const session = await auth();
  if (session?.user?.role !== "owner" && session?.user?.role !== "admin") {
    return <RestrictedAppPage message="Only workspace admins and the owner can access sequences. Contact your workspace owner if you need access." />;
  }

  const sequences = await listSequences();
  return <SequencesView sequences={sequences} />;
}
