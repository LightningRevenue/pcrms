import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { db } from "@/lib/db";
import { getSetting, setSetting } from "@/lib/workspace-settings";
import { encrypt, decrypt } from "@/lib/encryption";

const CRON_JOB_NAME = "db-backup";
const BACKUP_DIR = process.env.BACKUP_DIR || "/home/ubuntu/backups";
const LOCAL_RETENTION_DAYS = 7;

const SETTING_KEYS = {
  s3Bucket: "backup_s3_bucket",
  s3Region: "backup_s3_region",
  s3AccessKeyId: "backup_s3_access_key_id", // encrypted
  s3SecretAccessKey: "backup_s3_secret_access_key", // encrypted
} as const;

export type S3BackupConfig = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
};

// Global (workspaceId: null) settings — this is one EC2 instance's Postgres, not a
// per-workspace concept, same reasoning as SETTING_KEYS.appBaseUrl in workspace-settings.ts.
export async function getS3BackupConfig(): Promise<S3BackupConfig | null> {
  const [bucket, region, accessKeyIdEnc, secretAccessKeyEnc] = await Promise.all([
    getSetting(SETTING_KEYS.s3Bucket),
    getSetting(SETTING_KEYS.s3Region),
    getSetting(SETTING_KEYS.s3AccessKeyId),
    getSetting(SETTING_KEYS.s3SecretAccessKey),
  ]);
  if (!bucket || !region || !accessKeyIdEnc || !secretAccessKeyEnc) return null;
  return {
    bucket,
    region,
    accessKeyId: decrypt(accessKeyIdEnc),
    secretAccessKey: decrypt(secretAccessKeyEnc),
  };
}

export async function saveS3BackupConfig(config: S3BackupConfig) {
  await Promise.all([
    setSetting(SETTING_KEYS.s3Bucket, config.bucket),
    setSetting(SETTING_KEYS.s3Region, config.region),
    setSetting(SETTING_KEYS.s3AccessKeyId, encrypt(config.accessKeyId)),
    setSetting(SETTING_KEYS.s3SecretAccessKey, encrypt(config.secretAccessKey)),
  ]);
}

export async function hasS3BackupConfig() {
  return (await getS3BackupConfig()) !== null;
}

function parseDatabaseUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port || "5432",
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
  };
}

function runPgDump(outputPath: string) {
  const { host, port, user, password, database } = parseDatabaseUrl(process.env.DATABASE_URL!);

  return new Promise<void>((resolve, reject) => {
    // -Fc (custom format) is pg_restore-compatible and compressed by default — smaller than
    // plain SQL text and doesn't need a separate gzip step.
    const dump = spawn("pg_dump", ["-h", host, "-p", port, "-U", user, "-d", database, "-Fc", "-f", outputPath], {
      env: { ...process.env, PGPASSWORD: password },
    });

    let stderr = "";
    dump.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    dump.on("error", reject);
    dump.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pg_dump exited with code ${code}: ${stderr.slice(0, 2000)}`));
    });
  });
}

async function uploadToS3(filePath: string, key: string, config: S3BackupConfig) {
  const client = new S3Client({
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  const body = await readFile(filePath);
  await client.send(new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: body }));
}

async function pruneLocalBackups() {
  const cutoff = Date.now() - LOCAL_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const files = await readdir(BACKUP_DIR).catch(() => [] as string[]);
  for (const file of files) {
    if (!file.endsWith(".dump")) continue;
    const filePath = path.join(BACKUP_DIR, file);
    const stats = await stat(filePath);
    if (stats.mtimeMs < cutoff) await unlink(filePath).catch(() => {});
  }
}

// Runs pg_dump to local disk, uploads to S3 if configured, prunes old local dumps, and logs
// the outcome to CronJobRun (same table every other scheduled job in this app uses) — read
// by the /admin/database panel to show backup history without a dedicated model.
export async function runDatabaseBackup() {
  const run = await db.cronJobRun.create({ data: { job: CRON_JOB_NAME, status: "running" } });

  try {
    await mkdir(BACKUP_DIR, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `crm-${timestamp}.dump`;
    const filePath = path.join(BACKUP_DIR, filename);

    await runPgDump(filePath);

    const config = await getS3BackupConfig();
    if (config) {
      await uploadToS3(filePath, `db-backups/${filename}`, config);
    }

    await pruneLocalBackups();

    const { size } = await stat(filePath);

    await db.cronJobRun.update({
      where: { id: run.id },
      data: { status: "success", finishedAt: new Date(), emailsFound: Math.round(size / 1024) }, // KB, reusing the generic counter column
    });

    return { filename, sizeBytes: size, uploadedToS3: !!config };
  } catch (err) {
    await db.cronJobRun.update({
      where: { id: run.id },
      data: { status: "error", finishedAt: new Date(), error: err instanceof Error ? err.message : String(err) },
    });
    throw err;
  }
}

export async function listLocalBackups() {
  await mkdir(BACKUP_DIR, { recursive: true }).catch(() => {});
  const files = await readdir(BACKUP_DIR).catch(() => [] as string[]);
  const entries = await Promise.all(
    files
      .filter((f) => f.endsWith(".dump"))
      .map(async (f) => {
        const filePath = path.join(BACKUP_DIR, f);
        const stats = await stat(filePath);
        return { filename: f, sizeBytes: stats.size, createdAt: stats.mtime };
      })
  );
  return entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function listBackupRuns() {
  return db.cronJobRun.findMany({ where: { job: CRON_JOB_NAME }, orderBy: { startedAt: "desc" }, take: 20 });
}
