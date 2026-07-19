"use client";

import { useSession } from "next-auth/react";
import { ImageIcon, Upload, Trash2 } from "lucide-react";
import { SettingsHeader } from "@/components/settings-header";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [firstName, lastName] = (session?.user?.name ?? "").split(" ", 2);

  return (
    <>
      <SettingsHeader crumbs={["User", "Profile"]} />
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
          <div>
            <label className="text-[11px] text-subtle">First Name</label>
            <input
              defaultValue={firstName ?? ""}
              className="mt-1 w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-[13px] outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-[11px] text-subtle">Last Name</label>
            <input
              defaultValue={lastName ?? ""}
              className="mt-1 w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-[13px] outline-none focus:border-accent"
            />
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[13px] font-semibold">Email</h2>
        <p className="text-[12px] text-subtle mt-1">The email associated to your account</p>
        <div className="mt-3">
          <input
            readOnly
            defaultValue={session?.user?.email ?? ""}
            className="w-full px-2.5 py-1.5 rounded-md border border-border bg-muted text-[13px] text-subtle outline-none"
          />
        </div>
      </section>

      <section className="mt-8 pt-6 border-t border-border">
        <h2 className="text-[13px] font-semibold text-red-400">Danger zone</h2>
        <p className="text-[12px] text-subtle mt-1">Delete account and all the associated data</p>
        <button className="mt-3 px-2.5 py-1.5 rounded-md border border-red-500/50 text-[13px] text-red-400 hover:bg-red-500/10 transition-colors">
          Delete account
        </button>
      </section>
      </div>
    </>
  );
}
