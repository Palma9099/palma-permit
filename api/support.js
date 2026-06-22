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
    try { await notifyLead({ id: row.id, name, email, message }); } catch (_) { /* never block the lead on email */ }
    return res.status(201).json({ ok: true, id: row.id });
  } catch (e) {
    return res.status(500).json({ error: "db_error", message: String(e.message || e).slice(0, 200) });
  }
}

function esc(s) { return String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }

/** Email the lead to the office inbox via Resend. No-op unless RESEND_API_KEY is set. */
async function notifyLead({ id, name, email, message }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const to = process.env.LEAD_NOTIFY_TO || "office@palma.llc";
  const from = process.env.RESEND_FROM || "Palma Leads <onboarding@resend.dev>";
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#111">
    <h2 style="margin:0 0 8px">New lead from palma.llc</h2>
    <p style="margin:0 0 4px"><b>Name:</b> ${esc(name) || "—"}</p>
    <p style="margin:0 0 12px"><b>Email:</b> ${esc(email) || "—"}</p>
    <pre style="white-space:pre-wrap;font-family:inherit;background:#f6f6f6;padding:12px;border-radius:8px">${esc(message)}</pre>
    <p style="color:#888;font-size:12px">Lead #${id} · captured at palma.llc</p>
  </div>`;
  const body = { from, to, subject: "New lead from palma.llc" + (name ? ": " + name : ""), html };
  if (email && /.+@.+\..+/.test(email)) body.reply_to = email;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
