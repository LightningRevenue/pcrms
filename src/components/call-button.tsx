"use client";

import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Loader2 } from "lucide-react";
import { startCall, getVoiceStatus } from "@/lib/actions/calls";

type CallState = "idle" | "connecting" | "ringing" | "in-progress" | "ending";

export function CallButton({
  personId,
  phone,
  name,
  compact = false,
}: {
  personId: string;
  phone: string | null;
  name: string;
  // Icon-only, no label — used in the /lead/[id] quick-actions grid. Still shows the
  // in-progress label (ringing/timer) since that's live status, not a static caption.
  compact?: boolean;
}) {
  const [voiceReady, setVoiceReady] = useState<boolean | null>(null);
  const [state, setState] = useState<CallState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const deviceRef = useRef<import("@twilio/voice-sdk").Device | null>(null);
  const callRef = useRef<import("@twilio/voice-sdk").Call | null>(null);

  useEffect(() => {
    getVoiceStatus().then((s) => setVoiceReady(s.ready));
  }, []);

  useEffect(() => {
    if (state !== "in-progress") return;
    setSeconds(0);
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [state]);

  async function handleCall() {
    if (!phone) return;
    setState("connecting");
    setError(null);
    try {
      const { Device } = await import("@twilio/voice-sdk");
      const { callId, toNumber } = await startCall(personId);

      const res = await fetch("/api/twilio/token");
      const { token } = await res.json();
      if (!token) throw new Error("Could not get a Twilio access token");

      const device = new Device(token, { logLevel: "error" });
      deviceRef.current = device;
      await device.register();

      const call = await device.connect({ params: { To: toNumber, CallId: callId } });
      callRef.current = call;

      call.on("ringing", () => setState("ringing"));
      call.on("accept", () => setState("in-progress"));
      call.on("disconnect", () => cleanup());
      call.on("cancel", () => cleanup());
      call.on("error", () => cleanup());
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Something went wrong");
      cleanup();
    }
  }

  function cleanup() {
    setState("ending");
    callRef.current?.disconnect();
    deviceRef.current?.destroy();
    callRef.current = null;
    deviceRef.current = null;
    setTimeout(() => setState("idle"), 300);
  }

  function handleHangup() {
    cleanup();
  }

  useEffect(() => {
    return () => {
      callRef.current?.disconnect();
      deviceRef.current?.destroy();
    };
  }, []);

  if (state !== "idle") {
    const label =
      state === "connecting" ? "Connecting…" : state === "ringing" ? "Ringing…" : state === "in-progress" ? formatSeconds(seconds) : "Ending…";
    return (
      <button
        onClick={handleHangup}
        title={compact ? label : undefined}
        className={
          compact
            ? "flex items-center justify-center size-9 rounded-md border border-red-400/40 text-red-400 hover:bg-red-500/10 transition-colors"
            : "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-red-400/40 text-[13px] text-red-400 hover:bg-red-500/10 transition-colors"
        }
      >
        {state === "connecting" || state === "ending" ? (
          <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
        ) : (
          <PhoneOff size={14} strokeWidth={1.75} />
        )}
        {!compact && label}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={handleCall}
        disabled={!phone || voiceReady === false}
        title={!phone ? "This contact has no phone number" : voiceReady === false ? "Connect Twilio Voice in Settings first" : `Call ${name}`}
        className={
          compact
            ? "flex items-center justify-center size-9 rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            : "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[13px] hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        }
      >
        <Phone size={14} strokeWidth={1.75} />
        {!compact && "Call"}
      </button>
      {error && (
        <p className="absolute left-0 top-full mt-1 w-56 text-[12px] text-red-400 whitespace-normal z-10">{error}</p>
      )}
    </div>
  );
}

function formatSeconds(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
