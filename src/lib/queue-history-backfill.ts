import { db } from "@/lib/db";
import { historyBackfillQueue } from "@/lib/history-backfill-queue";

// Every path that creates a contact routes through here, so prior conversation history gets
// pulled in no matter how the contact arrived (panel, CSV import, public API, lead tools).
// One job per person, so re-importing the same contact won't stack duplicate backfills.
// No ":" — BullMQ rejects it in a custom jobId (it's their Redis key separator).
export function backfillJobId(personId: string) {
  return `backfill-${personId}`;
}

export async function queueHistoryBackfill(personId: string, workspaceId: string) {
  // Marked pending *before* enqueueing, so the Emails tab shows the loading state even if the
  // contact page is opened before the worker picks the job up.
  await db.person.update({ where: { id: personId }, data: { historyBackfillStatus: "pending" } });

  try {
    await historyBackfillQueue.add(
      personId,
      { personId, workspaceId },
      { jobId: backfillJobId(personId), removeOnComplete: true }
    );
  } catch (err) {
    // Never fail the contact creation itself over the backfill, but clear the pending flag so
    // the tab doesn't spin forever on a job that was never queued. Logged rather than silent:
    // swallowing this is what made a malformed jobId look like an empty Emails tab.
    console.error("queueHistoryBackfill: enqueue failed", err);
    await db.person
      .update({ where: { id: personId }, data: { historyBackfillStatus: "failed" } })
      .catch(() => {});
  }
}
