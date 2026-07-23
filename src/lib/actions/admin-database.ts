"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import {
  runDatabaseBackup,
  listLocalBackups,
  listBackupRuns,
  getS3BackupConfig,
  saveS3BackupConfig,
} from "@/lib/db-backup";

export async function getDatabaseStatus() {
  await requirePlatformAdmin();

  const [sizeResult, versionResult] = await Promise.all([
    db.$queryRaw<{ size: string }[]>`SELECT pg_size_pretty(pg_database_size(current_database())) as size`,
    db.$queryRaw<{ version: string }[]>`SELECT version()`,
  ]);

  // Best-effort weak-credentials check — never surfaces the actual password, just whether it
  // still matches the docker-compose.yml default committed in this repo (crm/crm). A false
  // negative here (custom-but-still-weak password) is fine; the point is catching "never rotated".
  const usingDefaultPassword = process.env.DATABASE_URL?.includes("crm:crm@") ?? false;
  const redisHasPassword = (process.env.REDIS_URL ?? "").includes("@");

  return {
    sizePretty: sizeResult[0]?.size ?? "unknown",
    version: versionResult[0]?.version?.split(" ").slice(0, 2).join(" ") ?? "unknown",
    usingDefaultPassword,
    redisHasPassword,
  };
}

export async function getS3Config() {
  await requirePlatformAdmin();
  const config = await getS3BackupConfig();
  if (!config) return null;
  // Never send the secret key back to the client — the form shows "configured" and lets you
  // overwrite it, not edit the existing value in place.
  return { bucket: config.bucket, region: config.region, accessKeyId: config.accessKeyId };
}

export async function saveS3Config(input: { bucket: string; region: string; accessKeyId: string; secretAccessKey: string }) {
  await requirePlatformAdmin();

  const bucket = input.bucket.trim();
  const region = input.region.trim();
  const accessKeyId = input.accessKeyId.trim();
  const secretAccessKey = input.secretAccessKey.trim();
  if (!bucket || !region || !accessKeyId) {
    throw new Error("Bucket, region, and access key ID are required");
  }

  // Blank secret means "keep the existing one" — the form never re-displays it once saved
  // (see getS3Config), so an empty submit here isn't "clear the secret", it's "unchanged".
  let finalSecretAccessKey = secretAccessKey;
  if (!finalSecretAccessKey) {
    const existing = await getS3BackupConfig();
    if (!existing) throw new Error("Secret access key is required");
    finalSecretAccessKey = existing.secretAccessKey;
  }

  await saveS3BackupConfig({ bucket, region, accessKeyId, secretAccessKey: finalSecretAccessKey });
  revalidatePath("/admin/database");
}

export async function listBackups() {
  await requirePlatformAdmin();
  const [local, runs] = await Promise.all([listLocalBackups(), listBackupRuns()]);
  return { local, runs };
}

export async function triggerBackupNow() {
  await requirePlatformAdmin();
  const result = await runDatabaseBackup();
  revalidatePath("/admin/database");
  return result;
}
