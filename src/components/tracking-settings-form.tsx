"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { saveTrackingSettings } from "@/lib/actions/workspace-settings";

export function TrackingSettingsForm({
  initialAppBaseUrl,
  initialTrackingDomain,
}: {
  initialAppBaseUrl: string;
  initialTrackingDomain: string;
}) {
  const [appBaseUrl, setAppBaseUrl] = useState(initialAppBaseUrl);
  const [trackingDomain, setTrackingDomain] = useState(initialTrackingDomain);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(false);
    startTransition(async () => {
      await saveTrackingSettings({ appBaseUrl, trackingDomain });
      setSaved(true);
    });
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-[13px] font-semibold">App URL</h2>
        <p className="text-[12px] text-subtle mt-1">
          Used as the tracking domain when no custom domain is set below. Must be publicly
          reachable so email clients can load the tracking pixel.
        </p>
        <input
          value={appBaseUrl}
          onChange={(e) => setAppBaseUrl(e.target.value)}
          placeholder="https://crm.yourcompany.com"
          className="mt-2 w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-[13px] outline-none focus:border-accent"
        />
      </section>

      <section>
        <h2 className="text-[13px] font-semibold">Custom tracking domain</h2>
        <p className="text-[12px] text-subtle mt-1">
          Optional. Use your own subdomain (e.g. <code>track.yourcompany.com</code>) so tracking
          links don&rsquo;t show a third-party domain. See setup guide below.
        </p>
        <input
          value={trackingDomain}
          onChange={(e) => setTrackingDomain(e.target.value)}
          placeholder="track.yourcompany.com"
          className="mt-2 w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-[13px] outline-none focus:border-accent"
        />
      </section>

      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="px-3 py-1.5 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-[12px] text-emerald-400">
            <Check size={14} strokeWidth={1.75} />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}
