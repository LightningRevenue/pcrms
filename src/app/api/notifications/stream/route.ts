import IORedis from "ioredis";
import { auth } from "@/lib/auth";
import { notificationChannel } from "@/lib/redis";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const userId = session.user.id;
  const subscriber = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });

  let keepAlive: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      await subscriber.subscribe(notificationChannel(userId));
      subscriber.on("message", (_channel, message) => {
        controller.enqueue(encoder.encode(`data: ${message}\n\n`));
      });

      controller.enqueue(encoder.encode(": connected\n\n"));

      keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, 25_000);
    },
    cancel() {
      clearInterval(keepAlive);
      subscriber.disconnect();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
