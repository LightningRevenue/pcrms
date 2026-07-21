import { auth } from "@/lib/auth";
import { SettingsHeader } from "@/components/settings-header";
import { CronJobPanel } from "@/components/cron-job-panel";
import { RestrictedSettingsPage } from "@/components/restricted-settings-page";
import { listCronJobRuns, runGmailSyncNow, runSequenceStepsNow, runTrashPurgeNow } from "@/lib/actions/cron-jobs";

export default async function CronJobsPage() {
  const session = await auth();
  if (session?.user?.role !== "owner") {
    return <RestrictedSettingsPage crumbs={["Workspace", "Cron Jobs"]} requiredRole="owner" />;
  }

  const [gmailRuns, sequenceRuns, trashRuns] = await Promise.all([
    listCronJobRuns("gmail-reply-sync"),
    listCronJobRuns("sequence-step-runner"),
    listCronJobRuns("trash-purge"),
  ]);

  return (
    <>
      <SettingsHeader crumbs={["Workspace", "Cron Jobs"]} />
      <div className="px-8 py-10 max-w-2xl">
        <h1 className="text-xl font-medium">Cron Jobs</h1>
        <p className="text-[13px] text-subtle mt-2 mb-6">
          Background jobs that keep your workspace in sync.
        </p>

        <CronJobPanel
          title="gmail-reply-sync"
          description="Checks connected Gmail threads for new replies every 2 minutes."
          countLabel="Emails found"
          runs={gmailRuns}
          onRunNow={runGmailSyncNow}
        />

        <div className="mt-10">
          <CronJobPanel
            title="sequence-step-runner"
            description="Sends due sequence emails and creates due tasks/notes every 5 minutes."
            countLabel="Steps executed"
            runs={sequenceRuns}
            onRunNow={runSequenceStepsNow}
          />
        </div>

        <div className="mt-10">
          <CronJobPanel
            title="trash-purge"
            description="Permanently deletes companies/contacts/opportunities that have sat in Trash for 30+ days, once a day."
            countLabel="Rows purged"
            runs={trashRuns}
            onRunNow={runTrashPurgeNow}
          />
        </div>
      </div>
    </>
  );
}
