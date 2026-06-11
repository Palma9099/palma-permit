/**
 * POST /api/support — contact / support form.
 * Works signed-in (linked to user) or anonymous (name+email required).
 */
import { requireClerkUser, upsertUser, sql, ensureSchema, dbConfigured, readBody, audit } from "./_lib/db.js";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!dbConfigured()) return res.status(503).json({ error: "db_not_configured" });

  const b = readBody(req);
  const name = String(b.name || "").trim().slice(0, 120);
  const email = String(b.email || "").trim().slice(0, 200);
  const message = String(b.message || "").trim().slice(0, 5000);
  if (!message) return res.status(400).json({ error: "validation", message: "Message is required." });

  let userId = null;
  const auth = await requireClerkUser(req);

  try {
    await ensureSchema();
    if (auth) {
      const me = await upsertUser(auth.user);
      userId = me.id;
    } else if (!email || !/.+@.+\..+/.test(email)) {
      return res.status(400).json({ error: "validation", message: "A valid email is required." });
    }
    const q = sql();
    const [row] = await q`INSERT INTO support_messages (user_id, name, email, message)
      VALUES (${userId}, ${name || null}, ${email || null}, ${message}) RETURNING id`;
    await audit(userId, "support.created", { supportId: row.id });
    return res.status(201).json({ ok: true, id: row.id });
  } catch (e) {
    return res.status(500).json({ error: "db_error", message: String(e.message || e).slice(0, 200) });
  }
}
