"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export function CredentialsLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");

    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      setStatus("error");
    } else {
      window.location.href = "/";
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="name@example.com"
        className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-[13px] outline-none focus:border-accent transition-colors"
      />
      <input
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-[13px] outline-none focus:border-accent transition-colors"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full py-2.5 rounded-lg border border-border text-[13px] font-medium hover:bg-muted transition-colors disabled:opacity-50"
      >
        {status === "loading" ? "Signing in…" : "Sign in"}
      </button>
      {status === "error" && <p className="text-[12px] text-red-400">Incorrect email or password.</p>}
    </form>
  );
}
