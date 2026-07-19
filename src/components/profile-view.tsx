"use client";

import { useState, useTransition } from "react";
import type { User } from "@prisma/client";
import { ImageIcon, Upload, Trash2 } from "lucide-react";
import { updateProfile } from "@/lib/actions/profile";

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[11px] text-subtle">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-[13px] outline-none focus:border-accent placeholder:text-subtle"
      />
    </div>
  );
}

export function ProfileView({ user }: { user: User }) {
  const [firstName, setFirstName] = useState(user.firstName ?? "");
  const [lastName, setLastName] = useState(user.lastName ?? "");
  const [personalEmail, setPersonalEmail] = useState(user.personalEmail ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [website, setWebsite] = useState(user.website ?? "");
  const [title, setTitle] = useState(user.title ?? "");
  const [company, setCompany] = useState(user.company ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    if (!firstName.trim()) {
      setError("First name is required");
      return;
    }
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updateProfile({ firstName, lastName, personalEmail, phone, website, title, company });
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  return (
    <div className="px-8 py-10 max-w-2xl">
      <h1 className="text-xl font-medium">Profile</h1>

      <section className="mt-8">
        <h2 className="text-[13px] font-semibold">Picture</h2>
        <div className="mt-3 flex items-center gap-3">
          <div className="size-14 rounded-md bg-muted border border-border flex items-center justify-center">
            <ImageIcon size={20} strokeWidth={1.5} className="text-subtle" />
          </div>
          <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[13px] hover:bg-muted transition-colors">
            <Upload size={14} strokeWidth={1.75} />
            Upload
          </button>
          <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[13px] text-subtle hover:bg-muted transition-colors">
            <Trash2 size={14} strokeWidth={1.75} />
            Remove
          </button>
        </div>
        <p className="text-[12px] text-subtle mt-2">
          We support square PNGs, JPEGs and GIFs under 10MB
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-[13px] font-semibold">Name</h2>
        <p className="text-[12px] text-subtle mt-1">Your name as it will be displayed</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="First Name" value={firstName} onChange={setFirstName} />
          <Field label="Last Name" value={lastName} onChange={setLastName} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[13px] font-semibold">Work</h2>
        <p className="text-[12px] text-subtle mt-1">Your role and company</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Title" value={title} onChange={setTitle} placeholder="e.g. Account Executive" />
          <Field label="Company" value={company} onChange={setCompany} placeholder="e.g. Acme Inc." />
          <Field label="Website" value={website} onChange={setWebsite} placeholder="e.g. acme.com" />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[13px] font-semibold">Contact</h2>
        <p className="text-[12px] text-subtle mt-1">How people can reach you outside of your login email</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Personal Email" value={personalEmail} onChange={setPersonalEmail} placeholder="you@example.com" />
          <Field label="Phone Number" value={phone} onChange={setPhone} placeholder="+1 555 123 4567" />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[13px] font-semibold">Login Email</h2>
        <p className="text-[12px] text-subtle mt-1">The email associated to your account</p>
        <div className="mt-3">
          <input
            readOnly
            defaultValue={user.email ?? ""}
            className="w-full px-2.5 py-1.5 rounded-md border border-border bg-muted text-[13px] text-subtle outline-none"
          />
        </div>
      </section>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={pending}
          className="px-3 py-1.5 rounded-md bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {saved && <span className="text-[12px] text-subtle">Saved</span>}
        {error && <span className="text-[12px] text-red-400">{error}</span>}
      </div>

      <section className="mt-8 pt-6 border-t border-border">
        <h2 className="text-[13px] font-semibold text-red-400">Danger zone</h2>
        <p className="text-[12px] text-subtle mt-1">Delete account and all the associated data</p>
        <button className="mt-3 px-2.5 py-1.5 rounded-md border border-red-500/50 text-[13px] text-red-400 hover:bg-red-500/10 transition-colors">
          Delete account
        </button>
      </section>
    </div>
  );
}
