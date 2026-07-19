export const TRIGGER_TYPES = [
  "record_created",
  "record_updated",
  "record_deleted",
  "record_created_or_updated",
  "manual",
  "schedule",
  "webhook",
] as const;

export type TriggerType = (typeof TRIGGER_TYPES)[number];
