import { auth } from "@/lib/auth";
import { SettingsHeader } from "@/components/settings-header";
import { RestrictedSettingsPage } from "@/components/restricted-settings-page";
import { MailVerifierPanel } from "@/components/mail-verifier-panel";

export default async function MailVerifierPage() {
  const session = await auth();
  if (session?.user?.role !== "owner" && session?.user?.role !== "admin") {
    return <RestrictedSettingsPage crumbs={["Workspace", "Mail Verifier"]} requiredRole="admin" />;
  }

  return (
    <>
      <SettingsHeader crumbs={["Workspace", "Mail Verifier"]} />
      <div className="px-8 py-10 max-w-3xl">
        <h1 className="text-xl font-medium">Mail Verifier</h1>
        <p className="text-[13px] text-subtle mt-1">
          Enter a name and domain — guesses common email patterns and checks each via SMTP until it finds a deliverable one.
        </p>

        <MailVerifierPanel />
      </div>
    </>
  );
}
