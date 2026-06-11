/**
 * GET /api/me — profile + plan + dashboard counts for the signed-in user.
 * Upserts the users row from Clerk so the DB always mirrors auth state.
 */
import { requireClerkUser, upsertUser, sql, ensureSchema, dbConfigured, primaryEmail, isAdminEmail } from "./_lib/db.js";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });

  const auth = await requireClerkUser(req);
  if (!auth) return res.status(401).json({ error: "signin_required" });

  const email = primaryEmail(auth.user);
  const pm = auth.user.publicMetadata || {};
  const base = {
    clerkUserId: auth.userId,
    email,
    name: [auth.user.firstName, auth.user.lastName].filter(Boolean).join(" ") || null,
    plan: pm.plan || null,
    subStatus: pm.subStatus || null,
    isAdmin: isAdminEmail(email),
  };

  if (!dbConfigured()) {
    return res.status(200).json({ ...base, credits: 0, counts: { reports: 0, searches: 0 }, recentReports: [], recentSearches: [], db: false });
  }

  try {
    await ensureSchema();
    const row = await upsertUser(auth.user);
    const q = sql();
    const [rc] = await q`SELECT count(*)::int AS n FROM reports WHERE user_id = ${row.id}`;
    const [sc] = await q`SELECT count(*)::int AS n FROM searches WHERE user_id = ${row.id}`;
    const recentReports = await q`SELECT id, address, city, project_type, report_type, status, created_at
      FROM reports WHERE user_id = ${row.id} ORDER BY created_at DESC LIMIT 5`;
    const recentSearches = await q`SELECT id, address, city, status, created_at
      FROM searches WHERE user_id = ${row.id} ORDER BY created_at DESC LIMIT 5`;
    return res.status(200).json({
      ...base,
      role: row.role,
      credits: row.credits,
      counts: { reports: rc.n, searches: sc.n },
      recentReports,
      recentSearches,
      db: true,
    });
  } catch (e) {
    return res.status(500).json({ error: "db_error", message: String(e.message || e).slice(0, 200) });
  }
}
