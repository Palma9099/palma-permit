/**
 * Palma Permit — start a subscription checkout (Vercel Serverless Function)
 * Route: POST /api/checkout   Body: { plan: "pro"|"team", returnUrl }
 *
 * Requires a signed-in Clerk user. Creates a Stripe Checkout (subscription)
 * tied to that user so the webhook can grant access. The Stripe secret key,
 * price IDs, etc. live only in env vars.
 *
 * ENV: CLERK_SECRET_KEY, STRIPE_SECRET_KEY, STRIPE_PRICE_PRO, STRIPE_PRICE_TEAM
 */
import { createClerkClient, verifyToken } from "@clerk/backend";
import Stripe from "stripe";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const { CLERK_SECRET_KEY, STRIPE_SECRET_KEY, STRIPE_PRICE_PRO, STRIPE_PRICE_TEAM } = process.env;
  if (!CLERK_SECRET_KEY || !STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: "not_configured", message: "Billing is not configured yet." });
  }

  // 1) Authenticate the Clerk user
  const authz = req.headers.authorization || "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : null;
  if (!token) return res.status(401).json({ error: "signin_required", message: "Please sign in first." });

  let userId, user;
  try {
    const payload = await verifyToken(token, { secretKey: CLERK_SECRET_KEY });
    userId = payload.sub;
    const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });
    user = await clerk.users.getUser(userId);
  } catch (e) {
    return res.status(401).json({ error: "invalid_session", message: "Your session expired — sign in again." });
  }

  // 2) Map plan -> price
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const plan = (body.plan || "pro").toLowerCase();
  const priceMap = { pro: STRIPE_PRICE_PRO, team: STRIPE_PRICE_TEAM };
  const price = priceMap[plan];
  if (!price) return res.status(400).json({ error: "bad_plan", message: "Unknown plan: " + plan });

  const email = (user.emailAddresses && user.emailAddresses[0] && user.emailAddresses[0].emailAddress) || undefined;
  const existingCustomer = (user.publicMetadata && user.publicMetadata.stripeCustomerId) || undefined;
  const origin = (body.returnUrl && new URL(body.returnUrl).origin) || `https://${req.headers.host}`;

  try {
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      client_reference_id: userId,
      ...(existingCustomer ? { customer: existingCustomer } : { customer_email: email }),
      subscription_data: { metadata: { clerkUserId: userId, plan } },
      metadata: { clerkUserId: userId, plan },
      success_url: `${origin}/analyze.html?checkout=success`,
      cancel_url: `${origin}/pricing.html?checkout=cancelled`,
      allow_promotion_codes: true,
    });
    return res.status(200).json({ url: session.url });
  } catch (e) {
    return res.status(500).json({ error: "stripe_error", message: String(e.message || e).slice(0, 300) });
  }
}
