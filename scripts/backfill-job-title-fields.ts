import "dotenv/config";
import { db } from "@/lib/db";
import { deriveJobTitleFields } from "@/lib/job-title";

// One-time backfill: Person.seniority / Person.department are derived from jobTitle at write
// time, but every row that predates those columns has them null. This classifies the existing
// rows so the Lead Intelligence filters work on day one instead of only on newly-touched
// contacts. Idempotent — re-running it just rewrites the same values.
//
// Safe to run against live data: jobTitle itself is never modified, and rows whose derived
// values already match are skipped without a write.
async function main() {
  const people = await db.person.findMany({
    where: { jobTitle: { not: null } },
    select: { id: true, jobTitle: true, seniority: true, department: true },
  });

  let updated = 0;
  for (const person of people) {
    const derived = deriveJobTitleFields(person.jobTitle);
    if (derived.seniority === person.seniority && derived.department === person.department) continue;
    await db.person.update({ where: { id: person.id }, data: derived });
    updated++;
  }

  const classified = await db.person.count({ where: { seniority: { not: null } } });
  console.log(
    `Backfilled ${updated} of ${people.length} contacts with a job title. ` +
      `${classified} now have a seniority.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
