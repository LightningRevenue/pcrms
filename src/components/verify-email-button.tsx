"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, ShieldX, ShieldQuestion, Loader2 } from "lucide-react";
import { verifyPersonEmail } from "@/lib/actions/email-verify";

export function VerifyEmailButton({
  personId,
  status,
  verifiedAt,
  reason,
}: {
  personId: string;
  status: string | null;
  verifiedAt: Date | null;
  reason: string | null;
}) {
  const [state, setState] = useState<{ status: string | null; reason: string | null }>({
    status,
    reason: reason && verifiedAt ? `${reason} (checked ${verifiedAt.toLocaleString("en-US")})` : null,
  });
  const [pending, startTransition] = useTransition();

  function verify() {
    startTransition(async () => {
      try {
        const result = await verifyPersonEmail(personId);
        setState({ status: result.catchAll ? "catch-all" : result.valid ? "valid" : "invalid", reason: result.reason });
      } catch (e) {
        setState({ status: "error", reason: e instanceof Error ? e.message : "Verification failed" });
      }
    });
  }

  const Icon = pending
    ? Loader2
    : state.status === "valid"
      ? ShieldCheck
      : state.status === "invalid"
        ? ShieldX
        : ShieldQuestion;

  const color = pending
    ? "text-subtle"
    : state.status === "valid"
      ? "text-green-600"
      : state.status === "invalid"
        ? "text-red-600"
        : state.status === "catch-all"
          ? "text-amber-500"
          : "text-subtle";

  return (
    <button
      onClick={verify}
      disabled={pending}
      title={state.reason ?? "Verify email deliverability"}
      className={`shrink-0 p-0.5 rounded hover:bg-muted transition-colors ${color}`}
    >
      <Icon size={13} strokeWidth={1.75} className={pending ? "animate-spin" : ""} />
    </button>
  );
}
