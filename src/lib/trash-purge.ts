import { db } from "@/lib/db";

const CRON_JOB_NAME = "trash-purge";
const RETENTION_DAYS = 30;

// Runs daily: hard-deletes Company/Person/Opportunity rows that have sat soft-deleted
// (deletedAt set) in Trash for longer than the retention window. See settings/trash and
// lib/actions/trash.ts for restore/manual-purge.
export async function runTrashPurge() {
  const run = await db.cronJobRun.create({ data: { job: CRON_JOB_NAME, status: "running" } });

  let purged = 0;
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const where = { deletedAt: { lt: cutoff } };

    const [companies, people, opportunities] = await Promise.all([
      db.company.deleteMany({ where }),
      db.person.deleteMany({ where }),
      db.opportunity.deleteMany({ where }),
    ]);
    purged = companies.count + people.count + opportunities.count;

    await db.cronJobRun.update({
      where: { id: run.id },
      data: { status: "success", finishedAt: new Date(), emailsFound: purged },
    });
  } catch (err) {
    await db.cronJobRun.update({
      where: { id: run.id },
      data: {
        status: "error",
        finishedAt: new Date(),
        emailsFound: purged,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }

  return purged;
}
