import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

const CRON_JOB_NAME = "stripe-reconcile";

// Daily safety net for the webhook-driven plan sync (see src/app/api/stripe/webhook/route.ts).
// The webhook is the fast path — this exists for the case where a webhook delivery is lost
// (server down at delivery time, Stripe's retries exhausted, or some other silent failure) and
// a workspace's plan would otherwise drift from what it's actually being billed for, forever.
// Not scoped by workspaceId — runs globally across every workspace with a Stripe subscription,
// same pattern as runGmailReplySync/runDueSequenceSteps.
export async function runStripeReconcile() {
  const run = await db.cronJobRun.create({ data: { job: CRON_JOB_NAME, status: "running" } });

  let corrected = 0;
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      // Nothing to reconcile against — Stripe isn't configured yet. Not an error: most
      // workspaces on a fresh deploy have no subscription at all.
      await db.cronJobRun.update({
        where: { id: run.id },
        data: { status: "success", finishedAt: new Date(), emailsFound: 0 },
      });
      return 0;
    }

    const stripe = getStripe();
    const defaultPlan = await db.plan.findFirst({ where: { isDefault: true } });
    const workspaces = await db.workspace.findMany({
      where: { stripeSubscriptionId: { not: null } },
      select: { id: true, planId: true, stripeSubscriptionId: true },
    });

    for (const workspace of workspaces) {
      if (!workspace.stripeSubscriptionId) continue;

      let subscription;
      try {
        subscription = await stripe.subscriptions.retrieve(workspace.stripeSubscriptionId);
      } catch {
        // Subscription no longer exists on Stripe's side at all (deleted, or the id was
        // stale) — fall back to the default plan rather than leaving it on a paid tier.
        if (defaultPlan && workspace.planId !== defaultPlan.id) {
          await db.workspace.update({ where: { id: workspace.id }, data: { planId: defaultPlan.id } });
          corrected++;
        }
        continue;
      }

      // Mirrors the grace period in the webhook handler (route.ts) — past_due keeps its
      // current paid plan while Stripe's own retry schedule is still trying to collect.
      const keepsCurrentPlan =
        subscription.status === "active" || subscription.status === "trialing" || subscription.status === "past_due";
      const priceId = subscription.items.data[0]?.price.id;
      const correctPlan = keepsCurrentPlan && priceId ? await db.plan.findUnique({ where: { stripePriceId: priceId } }) : defaultPlan;

      if (correctPlan && correctPlan.id !== workspace.planId) {
        await db.workspace.update({ where: { id: workspace.id }, data: { planId: correctPlan.id } });
        corrected++;
      }
    }

    await db.cronJobRun.update({
      where: { id: run.id },
      data: { status: "success", finishedAt: new Date(), emailsFound: corrected },
    });
  } catch (err) {
    await db.cronJobRun.update({
      where: { id: run.id },
      data: {
        status: "error",
        finishedAt: new Date(),
        emailsFound: corrected,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }

  return corrected;
}
