/**
 * /api/admin — admin data views + actions. Gated by ADMIN_EMAILS env var.
 *   GET  ?view=summary|users|reports|searches|payments|subscriptions|support
 *   POST { action: "report.status", id, status }       — update report status
 *   POST { action: "support.status", id, status }      — update support msg status
 */
import { requireClerkUser, sql, ensureSchema, dbConfigured, primaryEmail, isAdminEmail, readBody, audit, upsertUser } from "./_lib/db.js";

const REPORT_STATUSES = ["draft", "pending_payment", "processing", "complete", "failed", "needs_review"];
const SUPPORT_STATUSES = ["open", "in_progress", "closed"];

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  const auth = await requireClerkUser(req);
  if (!auth) return res.status(401).json({ error: "signin_required" });
  const email = primaryEmail(auth.user);
  if (!isAdminEmail(email)) return res.status(403).json({ error: "forbidden" });
  if (!dbConfigured()) return res.status(503).json({ error: "db_not_configured" });

  try {
    await ensureSchema();
    const me = await upsertUser(auth.user);
    const q = sql();

    if (req.method === "GET") {
      const view = String((req.query && req.query.view) || "summary");
      switch (view) {
        case "summary": {
          const [u] = await q`SELECT count(*)::int AS n FROM users`;
          const [r] = await q`SELECT count(*)::int AS n FROM reports`;
          const [s] = await q`SELECT count(*)::int AS n FROM searches`;
          const [p] = await q`SELECT count(*)::int AS n, COALESCE(sum(amount),0)::int AS total FROM payments WHERE status = 'paid'`;
          const [sub] = await q`SELECT count(*)::int AS n FROM subscriptions WHERE status IN ('active','trialing')`;
          const [sm] = await q`SELECT count(*)::int AS n FROM support_messages WHERE status = 'open'`;
          const recent = await q`SELECT action, metadata, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 15`;
          return res.json({ users: u.n, reports: r.n, searches: s.n, paidPayments: p.n, revenueCents: p.total, activeSubs: sub.n, openSupport: sm.n, recentActivity: recent });
        }
        case "users":
          return res.json({ rows: await q`SELECT id, clerk_user_id, email, name, role, plan, credits, stripe_customer_id, created_at FROM users ORDER BY created_at DESC LIMIT 200` });
        case "reports":
          return res.json({ rows: await q`SELECT r.id, r.address, r.city, r.project_type, r.status, r.created_at, u.email
            FROM reports r LEFT JOIN users u ON u.id = r.user_id ORDER BY r.created_at DESC LIMIT 200` });
        case "searches":
          return res.json({ rows: await q`SELECT s.id, s.address, s.city, s.status, s.created_at, u.email
            FROM searches s LEFT JOIN users u ON u.id = s.user_id ORDER BY s.created_at DESC LIMIT 200` });
        case "payments":
          return res.json({ rows: await q`SELECT p.id, p.amount, p.currency, p.status, p.product_type, p.stripe_checkout_session_id, p.created_at, u.email
            FROM payments p LEFT JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC LIMIT 200` });
        case "subscriptions":
          return res.json({ rows: await q`SELECT s.id, s.plan, s.status, s.stripe_subscription_id, s.current_period_end, s.created_at, u.email
            FROM subscriptions s LEFT JOIN users u ON u.id = s.user_id ORDER BY s.created_at DESC LIMIT 200` });
        case "support":
          return res.json({ rows: await q`SELECT m.id, m.name, m.email, m.message, m.status, m.created_at, u.email AS user_email
            FROM support_messages m LEFT JOIN users u ON u.id = m.user_id ORDER BY m.created_at DESC LIMIT 200` });
        default:
          return res.status(400).json({ error: "bad_view" });
      }
    }

    if (req.method === "POST") {
      const b = readBody(req);
      const id = parseInt(String(b.id || ""), 10);
      if (!id) return res.status(400).json({ error: "validation", message: "id required" });

      if (b.action === "report.status" && REPORT_STATUSES.includes(b.status)) {
        await q`UPDATE reports SET status = ${b.status}, updated_at = now() WHERE id = ${id}`;
        await audit(me.id, "admin.report.status", { id, status: b.status });
        return res.json({ ok: true });
      }
      if (b.action === "support.status" && SUPPORT_STATUSES.includes(b.status)) {
        await q`UPDATE support_messages SET status = ${b.status} WHERE id = ${id}`;
        await audit(me.id, "admin.support.status", { id, status: b.status });
        return res.json({ ok: true });
      }
      return res.status(400).json({ error: "bad_action" });
    }

    return res.status(405).json({ error: "method_not_allowed" });
  } catch (e) {
    return res.status(500).json({ error: "db_error", message: String(e.message || e).slice(0, 200) });
  }
}
