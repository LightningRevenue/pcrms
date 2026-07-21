import "dotenv/config";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { db } from "@/lib/db";
import { publishNotification } from "@/lib/redis";
import { runImport, type ImportJobData } from "@/lib/run-import";
import { IMPORT_JOB_NAME } from "@/lib/import-queue";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

async function main() {
  new Worker<ImportJobData>(
    IMPORT_JOB_NAME,
    async (job) => {
      const result = await runImport(job.data);
      const batch = await db.importBatch.findUniqueOrThrow({ where: { id: job.data.batchId, workspaceId: job.data.workspaceId } });

      const notification = await db.notification.create({
        data: {
          workspaceId: job.data.workspaceId,
          userId: job.data.userId,
          kind: "import_complete",
          title: `Import "${batch.name}" finished`,
          body: result
            ? `${result.success} of ${result.total} rows imported${result.errors.length ? `, ${result.errors.length} failed` : ""}`
            : undefined,
          link: job.data.objectType === "company" ? "/companies" : "/contacts",
        },
      });
      await publishNotification(job.data.userId, notification);
    },
    { connection, lockDuration: 10 * 60 * 1000 }
  );

  console.log("import-worker started, waiting for jobs");
}

main().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
