/**
 * Palma Permit — Stripe webhook (Vercel Serverless Function)
 * Route: POST /api/stripe-webhook
 *
 * Keeps each Clerk user's plan in sync with Stripe. On subscription
 * events it writes publicMetadata.{plan, subStatus, stripeCustomerId,
 * stripeSubId} on the Clerk user — which is what /api/analyze checks.
 *
 * Add this URL as a Stripe webhook endpoint and subscribe to:
 *   checkout.session.completed, customer.subscription.created,
 *   customer.subscription.updated, customer.subscription.deleted
 *
 * ENV: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, CLERK_SECRET_KEY,
 *      STRIPE_PRICE_PRO, STRIPE_PRICE_TEAM
 */
import { createClerkClient } from "@clerk/backend";
import Stripe from "stripe";
import { sql, ensureSchema, dbConfigured } from "./_lib/db.js";

export const config = { api: { bodyParser: false } }; // need the raw body for signature verification

/* ---- DB mirroring (best-effort; Clerk metadata stays the source of truth
        for the paywall, the DB powers dashboard/admin/reporting) ---------- */
async function dbUserIdFromClerkId(clerkUserId) {
  if (!clerkUserId) return null;
  const q = sql();
  const rows = await q`SELECT id FROM users WHERE clerk_user_id = ${clerkUserId}`;
  return rows.length ? rows[0].id : null;
}

async function recordPayment(session, clerkUserId, plan) {
  if (!dbConfigured()) return;
  try {
    await ensureSchema();
    const q = sql();
    const userId = await dbUserIdFromClerkId(clerkUserId);
    await q`INSERT INTO payments (user_id, stripe_customer_id, stripe_checkout_session_id, stripe_payment_intent_id, amount, currency, status, product_type)
      VALUES (${userId}, ${session.customer || null}, ${session.id}, ${session.payment_intent || null},
              ${session.amount_total ?? null}, ${session.currency || "usd"},
              ${session.payment_status === "paid" ? "paid" : session.payment_status || "unknown"},
              ${"subscription:" + (plan || "unknown")})`;
  } catch (e) { console.warn("[webhook] payment record failed:", e.message); }
}

async function recordSubscription(sub, clerkUserId, plan) {
  if (!dbConfigured()) return;
  try {
    await ensureSchema();
    const q = sql();
    const userId = await dbUserIdFromClerkId(clerkUserId);
    const ps = sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null;
    const pe = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
    await q`INSERT INTO subscriptions (user_id, stripe_subscription_id, stripe_customer_id, plan, status, current_period_start, current_period_end)
      VALUES (${userId}, ${sub.id}, ${sub.customer}, ${plan}, ${sub.status}, ${ps}, ${pe})
      ON CONFLICT (stripe_subscription_id) DO UPDATE SET
        plan = EXCLUDED.plan, status = EXCLUDED.status,
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        user_id = COALESCE(EXCLUDED.user_id, subscriptions.user_id),
        updated_at = now()`;
    if (userId) {
      const active = ["active", "trialing"].includes(sub.status);
      await q`UPDATE users SET plan = ${active ? plan : null}, stripe_customer_id = ${sub.customer}, updated_at = now() WHERE id = ${userId}`;
    }
  } catch (e) { console.warn("[webhook] subscription record failed:", e.message); }
}

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, CLERK_SECRET_KEY, STRIPE_PRICE_PRO, STRIPE_PRICE_TEAM } = process.env;
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !CLERK_SECRET_KEY) {
    return res.status(503).end("not_configured");
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY);
  const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });
  const planByPrice = { [STRIPE_PRICE_PRO]: "pro", [STRIPE_PRICE_TEAM]: "team" };

  let event;
  try {
    const raw = await readRaw(req);
    event = stripe.webhooks.constructEvent(raw, req.headers["stripe-signature"], STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }

  async function setUserPlan(clerkUserId, fields) {
    if (!clerkUserId) return;
    const u = await clerk.users.getUser(clerkUserId);
    await clerk.users.updateUser(clerkUserId, {
      publicMetadata: { ...(u.publicMetadata || {}), ...fields },
    });
  }

  async function clerkIdFromCustomer(customerId) {
    try {
      const c = await stripe.customers.retrieve(customerId);
      return (c && c.metadata && c.metadata.clerkUserId) || null;
    } catch (e) { return null; }
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.object || event.data.object;
        const session = event.data.object;
        const clerkUserId = session.client_reference_id || (session.metadata && session.metadata.clerkUserId);
        const plan = (session.metadata && session.metadata.plan) || "pro";
        // tag the customer so future subscription events can resolve the user
        if (session.customer && clerkUserId) {
          try { await stripe.customers.update(session.customer, { metadata: { clerkUserId } }); } catch (e) {}
        }
        await setUserPlan(clerkUserId, {
          plan, subStatus: "active",
          stripeCustomerId: session.customer || undefined,
          stripeSubId: session.subscription || undefined,
        });
        await recordPayment(session, clerkUserId, plan);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const clerkUserId = (sub.metadata && sub.metadata.clerkUserId) || (await clerkIdFromCustomer(sub.customer));
        const priceId = sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].price && sub.items.data[0].price.id;
        const plan = planByPrice[priceId] || "pro";
        const active = ["active", "trialing"].includes(sub.status);
        await setUserPlan(clerkUserId, {
          plan: active ? plan : null,
          subStatus: sub.status,
          stripeCustomerId: sub.customer,
          stripeSubId: sub.id,
        });
        await recordSubscription(sub, clerkUserId, plan);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const clerkUserId = (sub.metadata && sub.metadata.clerkUserId) || (await clerkIdFromCustomer(sub.customer));
        await setUserPlan(clerkUserId, { plan: null, subStatus: "canceled" });
        await recordSubscription(sub, clerkUserId, null);
        break;
      }
      default:
        break;
    }
    return res.status(200).json({ received: true });
  } catch (e) {
    return res.status(500).send("handler_error: " + String(e.message || e).slice(0, 200));
  }
}
