import { auth } from "@/lib/auth";
import { SettingsHeader } from "@/components/settings-header";
import { RestrictedSettingsPage } from "@/components/restricted-settings-page";
import { EmailVerifierPanel } from "@/components/email-verifier-panel";

export default async function EmailVerifierPage() {
  const session = await auth();
  if (session?.user?.role !== "owner" && session?.user?.role !== "admin") {
    return <RestrictedSettingsPage crumbs={["Workspace", "Email Verifier"]} requiredRole="admin" />;
  }

  return (
    <>
      <SettingsHeader crumbs={["Workspace", "Email Verifier"]} />
      <div className="px-8 py-10 max-w-3xl">
        <h1 className="text-xl font-medium">Email Verifier</h1>
        <p className="text-[13px] text-subtle mt-1">
          Check whether a contact&apos;s email address can actually receive mail, via a live SMTP handshake.
        </p>

        <EmailVerifierPanel />
      </div>
    </>
  );
}
