/**
 * /api/reports
 *   GET           — list the signed-in user's reports
 *   GET ?id=123   — single report (ownership enforced)
 */
import { requireClerkUser, upsertUser, sql, ensureSchema, dbConfigured } from "./_lib/db.js";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  const auth = await requireClerkUser(req);
  if (!auth) return res.status(401).json({ error: "signin_required" });
  if (!dbConfigured()) return res.status(503).json({ error: "db_not_configured" });

  try {
    await ensureSchema();
    const me = await upsertUser(auth.user);
    const q = sql();
    const id = req.query && req.query.id ? parseInt(String(req.query.id), 10) : null;

    if (id) {
      const rows = await q`SELECT id, address, city, state, project_type, report_type, status, summary, pdf_url, created_at, updated_at
        FROM reports WHERE id = ${id} AND user_id = ${me.id}`;
      if (!rows.length) return res.status(404).json({ error: "not_found" });
      return res.status(200).json({ report: rows[0] });
    }

    const rows = await q`SELECT id, address, city, state, project_type, report_type, status, created_at
      FROM reports WHERE user_id = ${me.id} ORDER BY created_at DESC LIMIT 100`;
    return res.status(200).json({ reports: rows });
  } catch (e) {
    return res.status(500).json({ error: "db_error", message: String(e.message || e).slice(0, 200) });
  }
}
