"use client";

import { useState, useTransition } from "react";
import { signup } from "@/lib/actions/signup";

export function SignupForm() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await signup(form);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create account");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <input
        required
        value={form.name}
        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
        placeholder="Full name"
        className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-[13px] outline-none focus:border-accent transition-colors"
      />
      <input
        type="email"
        required
        value={form.email}
        onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
        placeholder="name@company.com"
        className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-[13px] outline-none focus:border-accent transition-colors"
      />
      <input
        type="password"
        required
        minLength={8}
        value={form.password}
        onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
        placeholder="Password (min. 8 characters)"
        className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-[13px] outline-none focus:border-accent transition-colors"
      />
      <button
        type="submit"
        disabled={isPending}
        className="w-full py-2.5 rounded-lg bg-foreground text-background text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {isPending ? "Creating account…" : "Create account"}
      </button>
      {error && <p className="text-[12px] text-red-400">{error}</p>}
    </form>
  );
}
