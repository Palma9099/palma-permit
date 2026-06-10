/**
 * Palma Permit — Stripe billing portal (Vercel Serverless Function)
 * Route: POST /api/portal
 * Returns a Stripe Customer Portal URL for the signed-in user to manage
 * or cancel their subscription.
 *
 * ENV: CLERK_SECRET_KEY, STRIPE_SECRET_KEY
 */
import { createClerkClient, verifyToken } from "@clerk/backend";
import Stripe from "stripe";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const { CLERK_SECRET_KEY, STRIPE_SECRET_KEY } = process.env;
  if (!CLERK_SECRET_KEY || !STRIPE_SECRET_KEY) return res.status(503).json({ error: "not_configured" });

  const authz = req.headers.authorization || "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : null;
  if (!token) return res.status(401).json({ error: "signin_required" });

  try {
    const payload = await verifyToken(token, { secretKey: CLERK_SECRET_KEY });
    const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });
    const user = await clerk.users.getUser(payload.sub);
    const customer = user.publicMetadata && user.publicMetadata.stripeCustomerId;
    if (!customer) return res.status(404).json({ error: "no_subscription", message: "No active subscription found." });

    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `https://${req.headers.host}/analyze.html`,
    });
    return res.status(200).json({ url: session.url });
  } catch (e) {
    return res.status(500).json({ error: "portal_error", message: String(e.message || e).slice(0, 200) });
  }
}
