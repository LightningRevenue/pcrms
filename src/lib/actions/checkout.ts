"use server";

import { requireWorkspaceOwner } from "@/lib/workspace";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { getTrackingBaseUrl } from "@/lib/workspace-settings";

// Reuses an existing Stripe Customer for this workspace if one exists (set by a prior
// checkout or provisioned manually), otherwise creates one and persists the id — every
// later checkout/portal session for this workspace reuses the same Customer.
async function resolveStripeCustomerId(workspaceId: string, email: string | null) {
  const workspace = await db.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  if (workspace.stripeCustomerId) return workspace.stripeCustomerId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: email ?? undefined,
    name: workspace.name,
    metadata: { workspaceId },
  });
  await db.workspace.update({ where: { id: workspaceId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

// Starts a hosted Stripe Checkout session for the given plan. The actual plan switch happens
// later, in the webhook handler (checkout.session.completed / customer.subscription.updated)
// — not here — so a user closing the tab mid-checkout never leaves the workspace on a plan it
// hasn't actually paid for.
export async function createCheckoutSession(planId: string) {
  const { userId, workspaceId } = await requireWorkspaceOwner();

  const plan = await db.plan.findUniqueOrThrow({ where: { id: planId } });
  if (!plan.stripePriceId) throw new Error("This plan isn't available for self-serve checkout yet.");

  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  const customerId = await resolveStripeCustomerId(workspaceId, user?.email ?? null);

  const baseUrl = await getTrackingBaseUrl();
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${baseUrl}/settings/billing?checkout=success`,
    cancel_url: `${baseUrl}/settings/billing?checkout=cancelled`,
    client_reference_id: workspaceId,
    subscription_data: { metadata: { workspaceId, planId } },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

// Hosted Stripe page for managing/cancelling an existing subscription or updating payment
// details — nothing billing-specific to build ourselves. Requires an existing Customer
// (i.e. the workspace has checked out at least once before).
export async function createPortalSession() {
  const { workspaceId } = await requireWorkspaceOwner();

  const workspace = await db.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  if (!workspace.stripeCustomerId) throw new Error("No billing account yet — subscribe to a plan first.");

  const baseUrl = await getTrackingBaseUrl();
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: workspace.stripeCustomerId,
    return_url: `${baseUrl}/settings/billing`,
  });

  return session.url;
}
