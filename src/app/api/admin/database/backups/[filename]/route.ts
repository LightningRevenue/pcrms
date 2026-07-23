import { NextResponse } from "next/server";
import path from "node:path";
import { stat, readFile } from "node:fs/promises";
import { auth } from "@/lib/auth";

const BACKUP_DIR = process.env.BACKUP_DIR || "/home/ubuntu/backups";

// Excluded from the main auth proxy matcher like the other /api/* file-serving routes
// (see recordings/[callId]) — checks the session itself, gated on isPlatformAdmin rather
// than workspace membership since backups aren't a per-workspace concept.
export async function GET(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const session = await auth();
  if (!session?.user?.isPlatformAdmin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { filename } = await params;
  // Reject anything that isn't a plain filename we generated ourselves — blocks path
  // traversal (../../etc/passwd) before it ever touches the filesystem.
  if (!/^crm-[\w-]+\.dump$/.test(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filePath = path.join(BACKUP_DIR, filename);
  try {
    await stat(filePath);
  } catch {
    return NextResponse.json({ error: "Backup not found" }, { status: 404 });
  }

  const data = await readFile(filePath);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
