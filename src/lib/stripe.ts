import Stripe from "stripe";

let cached: Stripe | undefined;

// Lazily constructed (not at module load) so the app can still start — and every non-billing
// page/action still work — when STRIPE_SECRET_KEY isn't set yet, e.g. before an operator has
// created a Stripe account. Anything that actually needs Stripe (checkout, portal, webhook)
// calling this will throw a clear error instead of the app crashing at boot.
export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  cached = new Stripe(key);
  return cached;
}
