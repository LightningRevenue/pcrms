import { SettingsHeader } from "@/components/settings-header";
import { TwilioSettingsForm } from "@/components/twilio-settings-form";
import { getTwilioAccount } from "@/lib/actions/twilio";

export default async function TwilioSettingsPage() {
  const account = await getTwilioAccount();

  return (
    <>
      <SettingsHeader crumbs={["Accounts", "Twilio"]} />
      <div className="px-8 py-10 max-w-2xl">
        <h1 className="text-xl font-medium">Twilio</h1>
        <p className="text-[13px] text-subtle mt-1">
          Connect your Twilio account to enable calling from the CRM. Credentials are stored in
          the database, not in environment variables, so they can be rotated without a redeploy.
        </p>

        <TwilioSettingsForm account={account} />
      </div>
    </>
  );
}
