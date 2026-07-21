import { auth } from "@/lib/auth";
import { SettingsHeader } from "@/components/settings-header";
import { TrackingSettingsForm } from "@/components/tracking-settings-form";
import { RestrictedSettingsPage } from "@/components/restricted-settings-page";
import { getTrackingSettings } from "@/lib/actions/workspace-settings";

export default async function TrackingSettingsPage() {
  const session = await auth();
  if (session?.user?.role !== "owner") {
    return <RestrictedSettingsPage crumbs={["Workspace", "Email Tracking"]} requiredRole="owner" />;
  }

  const { appBaseUrl, trackingDomain } = await getTrackingSettings();

  return (
    <>
      <SettingsHeader crumbs={["Workspace", "Email Tracking"]} />
      <div className="px-8 py-10 max-w-2xl">
        <h1 className="text-xl font-medium">Email Tracking</h1>
        <p className="text-[13px] text-subtle mt-2 mb-6">
          Track when contacts open your emails. A tiny invisible pixel is embedded in every email
          you send — when it loads, we log the open.
        </p>

        <TrackingSettingsForm
          initialAppBaseUrl={appBaseUrl ?? ""}
          initialTrackingDomain={trackingDomain ?? ""}
        />

        <section className="mt-10 pt-6 border-t border-border">
          <h2 className="text-[13px] font-semibold">Custom tracking domain setup (EC2)</h2>
          <p className="text-[12px] text-subtle mt-1 mb-4">
            Point your own subdomain at this app so tracking links look like your brand instead
            of a shared domain. Skip this if the default App URL above is good enough — it works
            out of the box.
          </p>

          <ol className="space-y-4 text-[13px]">
            <li>
              <p className="font-medium">1. Launch (or reuse) an EC2 instance running the app</p>
              <p className="text-[12px] text-subtle mt-1">
                Any small instance works (e.g. <code>t3.micro</code>). Make sure Node.js and this
                app are deployed and listening on port 3000, and that the security group allows
                inbound HTTP (80) and HTTPS (443).
              </p>
            </li>
            <li>
              <p className="font-medium">2. Assign an Elastic IP</p>
              <p className="text-[12px] text-subtle mt-1">
                In the EC2 console, allocate an Elastic IP and associate it with your instance, so
                the public IP doesn&rsquo;t change on restart.
              </p>
            </li>
            <li>
              <p className="font-medium">3. Put a reverse proxy with TLS in front (Caddy or Nginx)</p>
              <p className="text-[12px] text-subtle mt-1">
                Easiest option is Caddy — it issues and renews the HTTPS certificate automatically.
                Example <code>Caddyfile</code>:
              </p>
              <pre className="mt-2 p-3 rounded-md bg-muted text-[12px] overflow-x-auto">
{`track.yourcompany.com {
  reverse_proxy localhost:3000
}`}
              </pre>
            </li>
            <li>
              <p className="font-medium">4. Add a DNS record</p>
              <p className="text-[12px] text-subtle mt-1">
                In your domain&rsquo;s DNS provider, add an <code>A</code> record for{" "}
                <code>track.yourcompany.com</code> pointing at your instance&rsquo;s Elastic IP
                (or a <code>CNAME</code> to the instance&rsquo;s public DNS name if you&rsquo;re
                not using an Elastic IP).
              </p>
            </li>
            <li>
              <p className="font-medium">5. Set the domain above</p>
              <p className="text-[12px] text-subtle mt-1">
                Enter <code>track.yourcompany.com</code> in the &ldquo;Custom tracking
                domain&rdquo; field and save. New emails will use it immediately.
              </p>
            </li>
          </ol>
        </section>
      </div>
    </>
  );
}
