/**
 * GET /api/health — config status (booleans only; never values).
 */
import { dbConfigured, ensureSchema } from "./_lib/db.js";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  const env = process.env;
  let dbOk = false;
  if (dbConfigured()) {
    try { await ensureSchema(); dbOk = true; } catch (e) { dbOk = false; }
  }
  return res.status(200).json({
    ok: true,
    time: new Date().toISOString(),
    config: {
      clerk: !!env.CLERK_SECRET_KEY,
      stripe: !!env.STRIPE_SECRET_KEY,
      stripeWebhook: !!env.STRIPE_WEBHOOK_SECRET,
      pricePro: !!env.STRIPE_PRICE_PRO,
      priceTeam: !!env.STRIPE_PRICE_TEAM,
      anthropic: !!env.ANTHROPIC_API_KEY,
      database: dbConfigured(),
      databaseReachable: dbOk,
      adminEmails: !!env.ADMIN_EMAILS,
    },
  });
}
