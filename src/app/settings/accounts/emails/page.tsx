import { MoreVertical, Plus, Mail, Calendar, ChevronRight } from "lucide-react";
import { SettingsHeader } from "@/components/settings-header";
import { GoogleIcon } from "@/components/google-icon";
import { BlocklistForm } from "@/components/blocklist-form";
import { getConnectedGoogleAccount } from "@/lib/google-account";
import { signIn } from "@/lib/auth";

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const account = await getConnectedGoogleAccount();
  const { error } = await searchParams;

  return (
    <>
      <SettingsHeader crumbs={["Accounts", "Emails"]} />
      <div className="px-8 py-10 max-w-2xl">
        <section>
          <h2 className="text-[13px] font-semibold">Connected accounts</h2>
          <p className="text-[12px] text-subtle mt-1">Manage your internet accounts.</p>

          {error === "CantConnect" && (
            <p className="text-[13px] text-red-500 bg-red-500/10 rounded-md px-3 py-2 mt-3">
              You can&apos;t connect with this email address.
            </p>
          )}

          <table className="w-full mt-4 text-left">
            <thead>
              <tr className="text-[11px] text-subtle border-b border-border">
                <th className="font-normal pb-2">Account</th>
                <th className="font-normal pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {account ? (
                <tr className="border-b border-border">
                  <td className="py-3 text-[13px] flex items-center gap-2">
                    <GoogleIcon />
                    {account.email}
                  </td>
                  <td className="py-3">
                    {account.gmailConnected ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[11px]">
                        <span className="size-1.5 rounded-full bg-white" />
                        Synced
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-subtle text-[11px]">
                        <span className="size-1.5 rounded-full bg-subtle" />
                        Not connected
                      </span>
                    )}
                  </td>
                  <td className="py-3 w-8 text-right">
                    <button className="p-1 rounded-md text-subtle hover:bg-muted hover:text-foreground transition-colors">
                      <MoreVertical size={14} strokeWidth={1.75} />
                    </button>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={3} className="py-3 text-[13px] text-subtle">
                    No accounts connected yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex justify-end mt-3">
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/settings/accounts/emails" });
              }}
            >
              <button
                type="submit"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[13px] hover:bg-muted transition-colors"
              >
                <Plus size={14} strokeWidth={1.75} />
                Add account
              </button>
            </form>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-[13px] font-semibold">Blocklist</h2>
          <p className="text-[12px] text-subtle mt-1">
            Exclude the following people and domains from my email sync. Internal conversations will not be imported
          </p>
          <BlocklistForm />
        </section>

        <section className="mt-8">
          <h2 className="text-[13px] font-semibold">Settings</h2>
          <p className="text-[12px] text-subtle mt-1">Configure your emails and calendar settings.</p>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <a
              href="/settings/accounts/emails"
              className="p-3 rounded-md border border-border hover:bg-muted transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[13px] font-medium">
                  <Mail size={15} strokeWidth={1.75} />
                  Emails
                </span>
                <ChevronRight size={14} strokeWidth={1.75} className="text-subtle" />
              </div>
              <p className="text-[12px] text-subtle mt-1.5">
                Set email visibility, manage your blocklist and more.
              </p>
            </a>

            <a
              href="/settings/accounts/calendars"
              className="p-3 rounded-md border border-border hover:bg-muted transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[13px] font-medium">
                  <Calendar size={15} strokeWidth={1.75} />
                  Calendar
                </span>
                <ChevronRight size={14} strokeWidth={1.75} className="text-subtle" />
              </div>
              <p className="text-[12px] text-subtle mt-1.5">
                Configure and customize your calendar preferences.
              </p>
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
