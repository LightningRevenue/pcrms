"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import type { TwilioAccount } from "@prisma/client";
import { saveTwilioAccount, deleteTwilioAccount, type TwilioAccountInput } from "@/lib/actions/twilio";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12px] text-subtle">{label}</span>
      <div className="mt-0.5">{children}</div>
      {hint && <span className="text-[11px] text-subtle block mt-0.5">{hint}</span>}
    </label>
  );
}

function MaskedField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center gap-2 border-b border-border focus-within:border-accent transition-colors">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 text-[13px] outline-none bg-transparent py-1.5"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="p-1 text-subtle hover:text-foreground transition-colors"
        title={show ? "Hide" : "Show"}
      >
        {show ? <EyeOff size={14} strokeWidth={1.75} /> : <Eye size={14} strokeWidth={1.75} />}
      </button>
    </div>
  );
}

const EMPTY_FORM: TwilioAccountInput = {
  accountSid: "",
  authToken: "",
  phoneNumber: "",
  apiKeySid: "",
  apiKeySecret: "",
  twimlAppSid: "",
};

export function TwilioSettingsForm({ account }: { account: TwilioAccount | null }) {
  const [form, setForm] = useState<TwilioAccountInput>({
    accountSid: account?.accountSid ?? "",
    authToken: account?.authToken ?? "",
    phoneNumber: account?.phoneNumber ?? "",
    apiKeySid: account?.apiKeySid ?? "",
    apiKeySecret: account?.apiKeySecret ?? "",
    twimlAppSid: account?.twimlAppSid ?? "",
  });
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof TwilioAccountInput>(key: K, value: TwilioAccountInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    if (!form.accountSid.trim() || !form.authToken.trim() || !form.phoneNumber.trim()) return;
    startTransition(async () => {
      await saveTwilioAccount(form);
      setSaved(true);
    });
  }

  function handleDisconnect() {
    if (!confirm("Disconnect Twilio? Calling will stop working until reconnected.")) return;
    startTransition(async () => {
      await deleteTwilioAccount();
      setForm(EMPTY_FORM);
      setSaved(false);
    });
  }

  return (
    <div className="mt-6 space-y-3 max-w-md">
      <p className="text-[12px] font-medium text-subtle uppercase tracking-wide">Account</p>

      <Field label="Account SID">
        <input
          value={form.accountSid}
          onChange={(e) => set("accountSid", e.target.value)}
          placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          className="w-full text-[13px] outline-none bg-transparent border-b border-border focus:border-accent transition-colors py-1.5"
        />
      </Field>

      <Field label="Auth Token">
        <MaskedField value={form.authToken} onChange={(v) => set("authToken", v)} placeholder="Your Twilio auth token" />
      </Field>

      <Field label="Twilio phone number">
        <input
          value={form.phoneNumber}
          onChange={(e) => set("phoneNumber", e.target.value)}
          placeholder="+15551234567"
          className="w-full text-[13px] outline-none bg-transparent border-b border-border focus:border-accent transition-colors py-1.5"
        />
      </Field>

      <p className="text-[12px] font-medium text-subtle uppercase tracking-wide pt-3">
        Browser calling (required for click-to-call)
      </p>

      <Field label="API Key SID" hint="Console → Account → API keys & tokens → Create API key">
        <input
          value={form.apiKeySid}
          onChange={(e) => set("apiKeySid", e.target.value)}
          placeholder="SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          className="w-full text-[13px] outline-none bg-transparent border-b border-border focus:border-accent transition-colors py-1.5"
        />
      </Field>

      <Field label="API Key Secret" hint="Shown once when the API key is created — copy it then">
        <MaskedField value={form.apiKeySecret} onChange={(v) => set("apiKeySecret", v)} placeholder="API key secret" />
      </Field>

      <Field label="TwiML App SID" hint="Console → Voice → Manage → TwiML Apps → Create new">
        <input
          value={form.twimlAppSid}
          onChange={(e) => set("twimlAppSid", e.target.value)}
          placeholder="APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          className="w-full text-[13px] outline-none bg-transparent border-b border-border focus:border-accent transition-colors py-1.5"
        />
      </Field>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={pending}
          className="px-3 py-1.5 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {saved && <span className="text-[12px] text-accent">Saved</span>}
        {account && (
          <button
            onClick={handleDisconnect}
            disabled={pending}
            className="flex items-center gap-1.5 text-[13px] text-red-400 hover:bg-red-500/10 px-2 py-1.5 rounded-md transition-colors disabled:opacity-50 ml-auto"
          >
            <Trash2 size={14} strokeWidth={1.75} />
            Disconnect
          </button>
        )}
      </div>

      {account && (
        <p className="text-[12px] text-subtle pt-1">
          Last updated {account.updatedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </p>
      )}
    </div>
  );
}
