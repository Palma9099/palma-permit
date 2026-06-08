# Palma Permit — Deploy Guide

This folder is a complete, static, production-ready website. The free analyzer
works with **no backend and no API key**. You only need a backend (the included
Cloudflare Function) when you turn on the paid "AI reads your PDFs" feature.

## Preview it right now (no deploy)
Double-click `index.html`. Everything runs locally in your browser —
analyzer, cities filter, all pages.

---

## Recommended: Cloudflare Pages (free, best fit for palma.llc)
Cloudflare is the easiest because it can host the site **and** manage DNS for
palma.llc in one place. ~10 minutes.

1. Go to https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Upload assets**.
2. Name the project `palma-permit`. Drag this entire folder in. Click **Deploy**.
   You'll get a live URL like `palma-permit.pages.dev` — verify the site there.
3. **Connect the domain:** project → **Custom domains** → **Set up a domain** → enter `palma.llc`.
   - If palma.llc's nameservers are already on Cloudflare, the DNS record is added automatically.
   - If not, Cloudflare shows you the CNAME/record to add at your current registrar (or move the domain's nameservers to Cloudflare). Add it; SSL provisions automatically in a few minutes.
4. Done — `https://palma.llc` is live.

### Turn on the AI deep-read (optional, when ready to charge)
1. Project → **Settings → Environment variables** → add `ANTHROPIC_API_KEY` = your key from console.anthropic.com.
   (Optional: `PP_MODEL` to override the default model.)
2. Redeploy. `functions/api/analyze.js` now serves `POST /api/analyze`.
   Until the key is set, the endpoint returns a clean "not configured" message and the free checklist keeps working.
3. Add payments (Stripe Checkout/Payment Links) before exposing it publicly so deep-reads consume a paid credit.

---

## Alternative: Netlify (also free)
- Fastest test: drag this folder onto https://app.netlify.com/drop — instant live URL, no login needed for a throwaway preview.
- Permanent: log in → **Add new site → Deploy manually** → drag the folder → **Domain settings** → add `palma.llc` and follow the DNS instructions.
- `_headers` is respected. For the AI function, move `functions/api/analyze.js` to `netlify/functions/analyze.js` (same code; Netlify uses a slightly different folder) and set `ANTHROPIC_API_KEY` in Site settings → Environment.

## Alternative: GitHub Pages (static only, no AI function)
Push this folder to a repo → Settings → Pages → deploy from branch. The included
`CNAME` file already contains `palma.llc`; add the matching DNS record at your registrar.
Note: GitHub Pages can't run the AI function — use Cloudflare/Netlify for that.

---

## DNS quick reference for palma.llc
At whatever controls palma.llc's DNS, you'll add one of:
- **Cloudflare Pages:** a CNAME (or automatic record if on Cloudflare nameservers).
- **Netlify:** CNAME `palma.llc` → your-site.netlify.app (or Netlify DNS).
- **GitHub Pages:** A records to GitHub's IPs + CNAME for www.
The host's dashboard shows the exact value during the "add custom domain" step.

## File map
```
index.html  analyze.html  cities.html  pricing.html  faq.html  404.html
assets/     styles.css  app.js  data.js
functions/api/analyze.js     ← optional AI backend (Cloudflare)
robots.txt  sitemap.xml  _headers  CNAME
```

## Maintaining the requirement data
All city/requirement/gotcha data lives in `assets/data.js`. Add a city by adding
an object to the `cities` array; add a permit type to `permitTypes`; add curated
city gotchas to the `gotchas` map. No build step — just edit and redeploy.
