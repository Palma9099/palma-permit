/**
 * Palma Permit — AI deep-read endpoint (Vercel Serverless Function)
 * Route: POST /api/analyze   (Vercel auto-maps api/analyze.js -> /api/analyze)
 *
 * Powers the premium "AI reads your PDFs" tier. The free checklist analyzer
 * runs entirely client-side and never calls this.
 *
 * SETUP: in the Vercel project → Settings → Environment Variables, add
 *   ANTHROPIC_API_KEY = <your key from console.anthropic.com>
 *   (optional) PP_MODEL = claude-sonnet-4-6
 * Until the key is set, this returns a clean "not configured" message and the
 * free analyzer keeps working.
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  try {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      return res.status(503).json({
        error: "not_configured",
        message: "AI deep-read is not enabled yet. Add ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables. The free checklist analyzer works without it.",
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
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
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
    catch { parsed = { compliance: null, verdict: "Could not parse AI response.", raw: text }; }
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: "server", message: String(e).slice(0, 300) });
  }
}
