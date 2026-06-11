/**
 * Palma Permit — shared DB + auth helpers for serverless functions.
 * Files under api/_lib are NOT exposed as routes (underscore prefix).
 *
 * Uses Neon serverless Postgres via DATABASE_URL (auto-injected by the
 * Vercel <-> Neon integration). Schema is created lazily (idempotent).
 */
import { neon } from "@neondatabase/serverless";
import { createClerkClient, verifyToken } from "@clerk/backend";

let _sql = null;
let _schemaReady = null;

export function sql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not configured");
    _sql = neon(url);
  }
  return _sql;
}

export function dbConfigured() {
  return !!process.env.DATABASE_URL;
}

/** Create all tables if they don't exist. Cached per warm instance. */
export function ensureSchema() {
  if (!_schemaReady) {
    const q = sql();
    _schemaReady = (async () => {
      await q`CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        clerk_user_id TEXT UNIQUE NOT NULL,
        email TEXT,
        name TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        plan TEXT,
        credits INTEGER NOT NULL DEFAULT 0,
        stripe_customer_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await q`CREATE TABLE IF NOT EXISTS searches (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users(id),
        address TEXT,
        city TEXT,
        state TEXT DEFAULT 'FL',
        query_payload JSONB,
        status TEXT NOT NULL DEFAULT 'submitted',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await q`CREATE TABLE IF NOT EXISTS reports (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users(id),
        search_id BIGINT REFERENCES searches(id),
        address TEXT,
        city TEXT,
        state TEXT DEFAULT 'FL',
        project_type TEXT,
        report_type TEXT DEFAULT 'permit_readiness',
        status TEXT NOT NULL DEFAULT 'processing',
        summary TEXT,
        pdf_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await q`CREATE TABLE IF NOT EXISTS payments (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users(id),
        stripe_customer_id TEXT,
        stripe_checkout_session_id TEXT,
        stripe_payment_intent_id TEXT,
        amount INTEGER,
        currency TEXT DEFAULT 'usd',
        status TEXT,
        product_type TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await q`CREATE TABLE IF NOT EXISTS subscriptions (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users(id),
        stripe_subscription_id TEXT UNIQUE,
        stripe_customer_id TEXT,
        plan TEXT,
        status TEXT,
        current_period_start TIMESTAMPTZ,
        current_period_end TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await q`CREATE TABLE IF NOT EXISTS support_messages (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users(id),
        name TEXT,
        email TEXT,
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await q`CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT,
        action TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    })().catch((e) => { _schemaReady = null; throw e; });
  }
  return _schemaReady;
}

/** Verify the Clerk bearer token. Returns { userId, user } or null. */
export async function requireClerkUser(req) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return null;
  const authz = req.headers.authorization || "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : null;
  if (!token) return null;
  try {
    const payload = await verifyToken(token, { secretKey });
    const clerk = createClerkClient({ secretKey });
    const user = await clerk.users.getUser(payload.sub);
    return { userId: payload.sub, user };
  } catch (e) {
    return null;
  }
}

export function primaryEmail(clerkUser) {
  return (
    (clerkUser.emailAddresses &&
      clerkUser.emailAddresses[0] &&
      clerkUser.emailAddresses[0].emailAddress) ||
    null
  );
}

export function displayName(clerkUser) {
  const n = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ");
  return n || null;
}

export function isAdminEmail(email) {
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return !!email && list.includes(email.toLowerCase());
}

/** Upsert the app user row from a Clerk user; returns the DB row. */
export async function upsertUser(clerkUser) {
  await ensureSchema();
  const q = sql();
  const email = primaryEmail(clerkUser);
  const name = displayName(clerkUser);
  const pm = clerkUser.publicMetadata || {};
  const plan = pm.plan || null;
  const stripeCustomerId = pm.stripeCustomerId || null;
  const role = isAdminEmail(email) ? "admin" : "user";
  const rows = await q`
    INSERT INTO users (clerk_user_id, email, name, role, plan, stripe_customer_id)
    VALUES (${clerkUser.id}, ${email}, ${name}, ${role}, ${plan}, ${stripeCustomerId})
    ON CONFLICT (clerk_user_id) DO UPDATE SET
      email = EXCLUDED.email,
      name = COALESCE(EXCLUDED.name, users.name),
      role = EXCLUDED.role,
      plan = EXCLUDED.plan,
      stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, users.stripe_customer_id),
      updated_at = now()
    RETURNING *`;
  return rows[0];
}

export async function audit(userId, action, metadata) {
  try {
    await ensureSchema();
    await sql()`INSERT INTO audit_logs (user_id, action, metadata)
      VALUES (${userId || null}, ${action}, ${JSON.stringify(metadata || {})})`;
  } catch (e) {
    /* audit must never break the request */
  }
}

export function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body || "{}");
  } catch (e) {
    return {};
  }
}
