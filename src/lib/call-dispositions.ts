export const CALL_DISPOSITIONS = [
  { value: "interested", label: "Interested" },
  { value: "not-interested", label: "Not interested" },
  { value: "voicemail", label: "Voicemail" },
  { value: "callback", label: "Callback" },
  { value: "no-answer", label: "No answer" },
  { value: "wrong-number", label: "Wrong number" },
] as const;

export type CallDisposition = (typeof CALL_DISPOSITIONS)[number]["value"];
