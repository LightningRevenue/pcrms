import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/admin";
import { getDatabaseStatus, getS3Config, listBackups } from "@/lib/actions/admin-database";
import { AdminDatabasePanel } from "@/components/admin-database-panel";

export default async function AdminDatabasePage() {
  await requirePlatformAdmin();

  const [status, s3Config, backups] = await Promise.all([getDatabaseStatus(), getS3Config(), listBackups()]);

  return (
    <div className="px-8 py-10 max-w-3xl mx-auto">
      <Link href="/admin" className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors">
        <ArrowLeft size={14} strokeWidth={1.75} />
        Admin
      </Link>

      <h1 className="text-xl font-medium mt-4">Database</h1>
      <p className="text-[13px] text-subtle mt-1">
        Postgres status, S3 backup destination, and backup history for this instance.
      </p>

      <AdminDatabasePanel status={status} initialS3Config={s3Config} initialBackups={backups} />
    </div>
  );
}
