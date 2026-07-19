import { Queue } from "bullmq";
import IORedis from "ioredis";

export const CAMPAIGN_JOB_NAME = "campaign-send";

export type CampaignSendJobData = {
  campaignMemberId: string;
  mailboxAccountId: string;
};

const globalForQueue = globalThis as unknown as { campaignQueue?: Queue<CampaignSendJobData> };

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const campaignQueue =
  globalForQueue.campaignQueue ?? new Queue<CampaignSendJobData>(CAMPAIGN_JOB_NAME, { connection });

if (process.env.NODE_ENV !== "production") globalForQueue.campaignQueue = campaignQueue;
