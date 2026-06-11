/**
 * /api/searches
 *   GET  — list the signed-in user's searches
 *   POST — create a search + a linked report stub (status: processing)
 *          Body: { address, city, state, projectType, permitQuestion }
 */
import { requireClerkUser, upsertUser, sql, ensureSchema, dbConfigured, readBody, audit } from "./_lib/db.js";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  const auth = await requireClerkUser(req);
  if (!auth) return res.status(401).json({ error: "signin_required" });
  if (!dbConfigured()) return res.status(503).json({ error: "db_not_configured" });

  try {
    await ensureSchema();
    const me = await upsertUser(auth.user);
    const q = sql();

    if (req.method === "GET") {
      const rows = await q`SELECT id, address, city, state, status, query_payload, created_at
        FROM searches WHERE user_id = ${me.id} ORDER BY created_at DESC LIMIT 50`;
      return res.status(200).json({ searches: rows });
    }

    if (req.method === "POST") {
      const b = readBody(req);
      const address = String(b.address || "").trim().slice(0, 300);
      const city = String(b.city || "").trim().slice(0, 100);
      const state = String(b.state || "FL").trim().slice(0, 30);
      const projectType = String(b.projectType || "").trim().slice(0, 100);
      const permitQuestion = String(b.permitQuestion || "").trim().slice(0, 2000);
      if (!address || !city) {
        return res.status(400).json({ error: "validation", message: "Address and city are required." });
      }
      const payload = { projectType, permitQuestion, propertyType: String(b.propertyType || "").slice(0, 100) };
      const [search] = await q`INSERT INTO searches (user_id, address, city, state, query_payload, status)
        VALUES (${me.id}, ${address}, ${city}, ${state}, ${JSON.stringify(payload)}, 'submitted') RETURNING id, created_at`;
      const [report] = await q`INSERT INTO reports (user_id, search_id, address, city, state, project_type, status, summary)
        VALUES (${me.id}, ${search.id}, ${address}, ${city}, ${state}, ${projectType || null}, 'processing',
                'Your report request has been received. Palma Permit is processing this report.') RETURNING id`;
      await audit(me.id, "search.created", { searchId: search.id, reportId: report.id, city });
      return res.status(201).json({ searchId: search.id, reportId: report.id });
    }

    return res.status(405).json({ error: "method_not_allowed" });
  } catch (e) {
    return res.status(500).json({ error: "db_error", message: String(e.message || e).slice(0, 200) });
  }
}
