"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { runGmailReplySync } from "@/lib/gmail-sync";
import { runDueSequenceSteps } from "@/lib/sequence-runner";

const GMAIL_JOB_NAME = "gmail-reply-sync";

export async function listCronJobRuns(job: string = GMAIL_JOB_NAME) {
  return db.cronJobRun.findMany({
    where: { job },
    orderBy: { startedAt: "desc" },
    take: 20,
  });
}

export async function runGmailSyncNow() {
  await runGmailReplySync().catch(() => {});
  revalidatePath("/settings/cron-jobs");
}

export async function runSequenceStepsNow() {
  await runDueSequenceSteps().catch(() => {});
  revalidatePath("/settings/cron-jobs");
}
