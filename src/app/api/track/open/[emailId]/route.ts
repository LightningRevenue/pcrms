import { db } from "@/lib/db";

// ponytail: smallest valid transparent GIF (43 bytes) — no image library needed
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7",
  "base64"
);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ emailId: string }> }
) {
  const { emailId } = await params;

  try {
    const email = await db.email.findUnique({ where: { id: emailId } });
    if (email) {
      await db.emailOpen.create({
        data: {
          emailId,
          ip: request.headers.get("x-forwarded-for") ?? undefined,
          userAgent: request.headers.get("user-agent") ?? undefined,
        },
      });
    }
  } catch {}

  return new Response(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
    },
  });
}
