/**
 * Palma Permit — automated deep-read endpoint (Vercel Serverless Function)
 * Route: POST /api/analyze
 *
 * GATED (Phase 2): when CLERK_SECRET_KEY is set, the caller must be a
 * signed-in Clerk user with an active paid plan (publicMetadata.plan in
 * PAID_PLANS). The plan is kept current by the Stripe webhook. This is the
 * real security boundary — hiding the button on the front end is not enough.
 *
 * FEATURE-FLAGGED: if CLERK_SECRET_KEY is not set, auth is skipped (the
 * site behaves as it did before Phase 2). If ANTHROPIC_API_KEY is not set,
 * it returns a clean "not configured" message.
 *
 * ENV: CLERK_SECRET_KEY, ANTHROPIC_API_KEY, (optional) PP_MODEL
 */
import { createClerkClient, verifyToken } from "@clerk/backend";

const PAID_PLANS = ["pro", "team"];

async function requirePaidUser(req) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return { ok: true, gated: false }; // auth disabled (pre-config)

  const authz = req.headers.authorization || req.headers.Authorization || "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : null;
  if (!token) return { ok: false, status: 401, code: "signin_required", message: "Sign in to run an automated deep-read." };

  let payload;
  try {
    payload = await verifyToken(token, { secretKey });
  } catch (e) {
    return { ok: false, status: 401, code: "invalid_session", message: "Your session expired — sign in again." };
  }

  try {
    const clerk = createClerkClient({ secretKey });
    const user = await clerk.users.getUser(payload.sub);
    const pm = user.publicMetadata || {};
    const active = !pm.subStatus || ["active", "trialing"].includes(pm.subStatus);
    if (!active || !PAID_PLANS.includes(pm.plan)) {
      return { ok: false, status: 402, code: "upgrade_required", message: "An active Pro or Team plan is required to run automated deep-reads." };
    }
    return { ok: true, gated: true, userId: payload.sub, plan: pm.plan };
  } catch (e) {
    return { ok: false, status: 500, code: "auth_error", message: "Could not verify your subscription." };
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  try {
    // 1) Gate: require a signed-in, paid user (when auth is configured)
    const gate = await requirePaidUser(req);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.code, message: gate.message });

    // 2) Require the model key
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      return res.status(503).json({
        error: "not_configured",
        message: "Automated deep-read is not enabled yet. Add ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables. The free checklist analyzer works without it.",
      });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { city, permitType, requiredDocs = [], documents = [] } = body;
    if (!city || !permitType) {
      return res.status(400).json({ error: "bad_request", message: "city and permitType are required." });
    }

    const sys =
      "You are a South Florida building-permit reviewer. Given a city, permit type, the city's required documents, " +
      "and the text of the contractor's uploaded documents, determine for each required document whether it is " +
      "Found, Missing, or Needs-attention (e.g. missing signature/seal, generic spec sheet instead of an FL#/NOA, " +
      "wrong insurance certificate holder). Be concise and practical. Respond ONLY with minified JSON matching: " +
      '{"compliance":0-100,"verdict":"string","items":[{"doc":"string","status":"found|missing|attention","note":"string"}]}';

    const user =
      `City: ${city}\nPermit type: ${permitType}\n` +
      `Required documents: ${JSON.stringify(requiredDocs)}\n\n` +
      `Uploaded documents:\n` +
      documents.map((d, i) => `[${i + 1}] ${d.name}\n${(d.text || "").slice(0, 6000)}`).join("\n\n");

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.PP_MODEL || "claude-sonnet-4-6",
        max_tokens: 1500,
        system: sys,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      return res.status(502).json({ error: "upstream", message: t.slice(0, 400) });
    }
    const data = await r.json();
    const text = (data.content && data.content[0] && data.content[0].text) || "{}";
    let parsed;
    try { parsed = JSON.parse(text); }
    catch { parsed = { compliance: null, verdict: "Could not parse engine response.", raw: text }; }
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: "server", message: String(e).slice(0, 300) });
  }
}
