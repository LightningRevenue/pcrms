"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export function MagicLinkForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    setError(null);

    const result = await signIn("nodemailer", { email, redirect: false });
    if (result?.error) {
      setStatus("error");
      setError("Couldn't send the link — check that this email was added in Settings > Members.");
    } else {
      setStatus("sent");
    }
  }

  if (status === "sent") {
    return <p className="text-[13px] text-subtle mt-4">Check your email for a sign-in link.</p>;
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="name@example.com"
        className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-[13px] outline-none focus:border-accent transition-colors"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full py-2.5 rounded-lg border border-border text-[13px] font-medium hover:bg-black/5 transition-colors disabled:opacity-50"
      >
        {status === "sending" ? "Sending…" : "Send magic link"}
      </button>
      {error && <p className="text-[12px] text-red-400">{error}</p>}
    </form>
  );
}
