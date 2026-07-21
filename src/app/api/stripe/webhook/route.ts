import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";

// The plan switch itself: looks up which Plan the subscription's Price maps to and assigns
// it to whichever workspace owns this Stripe Customer. Shared by every event below that
// carries a subscription, so "what plan is this workspace on" always derives from the same
// logic regardless of which event triggered it.
async function syncSubscriptionToWorkspace(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const workspace = await db.workspace.findUnique({ where: { stripeCustomerId: customerId } });
  if (!workspace) return; // not one of our workspaces (or webhook arrived before checkout finished persisting the customer)

  const priceId = subscription.items.data[0]?.price.id;
  const active = subscription.status === "active" || subscription.status === "trialing";

  if (!active) {
    // Subscription cancelled/unpaid/etc. — fall back to the default plan rather than leaving
    // the workspace on a paid plan's entitlements with nothing actually being billed.
    const defaultPlan = await db.plan.findFirst({ where: { isDefault: true } });
    await db.workspace.update({
      where: { id: workspace.id },
      data: { stripeSubscriptionId: subscription.id, ...(defaultPlan ? { planId: defaultPlan.id } : {}) },
    });
    return;
  }

  const plan = priceId ? await db.plan.findUnique({ where: { stripePriceId: priceId } }) : null;
  await db.workspace.update({
    where: { id: workspace.id },
    data: { stripeSubscriptionId: subscription.id, ...(plan ? { planId: plan.id } : {}) },
  });
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) return new NextResponse("Webhook not configured", { status: 400 });

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode === "subscription" && session.subscription) {
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
        await syncSubscriptionToWorkspace(subscription);
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncSubscriptionToWorkspace(event.data.object);
      break;
    }
    default:
      break; // ignore everything else — we only care about subscription state
  }

  return new NextResponse(null, { status: 200 });
}
