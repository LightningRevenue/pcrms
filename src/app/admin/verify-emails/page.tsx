import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/admin";
import { listVerifyBatches } from "@/lib/actions/verify-emails";
import { VerifyEmailsPanel } from "@/components/verify-emails-panel";

export default async function VerifyEmailsPage() {
  await requirePlatformAdmin();
  const batches = await listVerifyBatches();

  return (
    <div className="px-8 py-10 max-w-4xl mx-auto">
      <Link
        href="/admin"
        className="flex items-center gap-1.5 text-[13px] text-subtle hover:text-foreground transition-colors"
      >
        <ArrowLeft size={14} strokeWidth={1.75} />
        Admin
      </Link>

      <h1 className="text-xl font-medium mt-4">Verify Emails</h1>
      <p className="text-[13px] text-subtle mt-1">
        Upload a lead CSV, verify every address via SMTP handshake, then download the cleaned
        list. Uploads and results are kept so you can come back to any batch.
      </p>

      <VerifyEmailsPanel initialBatches={batches} />
    </div>
  );
}
