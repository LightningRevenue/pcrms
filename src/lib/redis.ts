import IORedis from "ioredis";

const globalForRedis = globalThis as unknown as { redisPublisher?: IORedis };

export const redisPublisher =
  globalForRedis.redisPublisher ??
  new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });

if (process.env.NODE_ENV !== "production") globalForRedis.redisPublisher = redisPublisher;

export function notificationChannel(userId: string) {
  return `notifications:${userId}`;
}

export async function publishNotification(userId: string, payload: unknown) {
  try {
    await redisPublisher.publish(notificationChannel(userId), JSON.stringify(payload));
  } catch {
    // ponytail: best-effort push — the notification row in DB is still the source of truth
  }
}
