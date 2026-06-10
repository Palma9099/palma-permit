# Phase 2 — Member accounts + gated deep-read (Clerk + Stripe)

All the code is written and **feature-flagged**: until you set the keys below,
the site behaves exactly as it does today (login is hidden, deep-read shows
"not enabled"). The moment the keys are present, login + paywall activate.

## What got built
- `assets/auth.js` — Clerk login on the front end, header user button, "Upgrade"/"Manage Subscription", and the deep-read gate UI.
- `api/analyze.js` — now **requires a signed-in user with an active Pro/Team plan** before calling the model (the real security gate).
- `api/checkout.js` — starts a Stripe subscription checkout tied to the logged-in user.
- `api/stripe-webhook.js` — syncs Stripe subscription status onto the Clerk user (`publicMetadata.plan`).
- `api/portal.js` — Stripe Customer Portal so members can manage/cancel.
- `package.json` — adds `@clerk/backend` + `stripe` for the functions.

## How entitlement works
A user's plan lives in their Clerk `publicMetadata.plan` (`"pro"` / `"team"`),
kept current by the Stripe webhook. `api/analyze.js` reads it server-side and
rejects anyone without an active plan — so the paywall can't be bypassed from
the browser.

---

## Setup checklist (≈30–40 min)

### 1. Clerk
1. Create an account at **clerk.com** → new application **"Palma Permit"**.
2. Enable sign-in methods (Email + Google recommended).
3. **Developers → API Keys**: copy the **Publishable key** and **Secret key** (use the **Production** instance for the live site).
4. **Domains**: add `permit.palma.llc` (and `palma-permit.vercel.app`).
5. Paste the **Publishable key** into `assets/auth.js` → replace `CLERK_PUBLISHABLE_KEY` (it's public, safe to commit).

### 2. Stripe — recurring prices (Live mode)
1. Product **"Palma Permit — Pro"** → price **$19.00 / month** → copy the **price ID** (`price_…`).
2. Product **"Palma Permit — Team"** → price **$49.00 / month** → copy its **price ID**.
   *(These are the subscription plans. The $3.99 single check stays a Payment Link — see "Product note" below.)*

### 3. Vercel env vars (palma-permit → Settings → Environment Variables)
```
CLERK_SECRET_KEY      = sk_live_…           (Clerk secret key)
STRIPE_SECRET_KEY     = sk_live_…           (Stripe secret key)
STRIPE_PRICE_PRO      = price_…             (Pro $19/mo price ID)
STRIPE_PRICE_TEAM     = price_…             (Team $49/mo price ID)
ANTHROPIC_API_KEY     = sk-ant-…            (turns the deep-read engine on)
```
Then **Redeploy**.

### 4. Stripe webhook
1. Stripe → **Developers → Webhooks → Add endpoint**: `https://permit.palma.llc/api/stripe-webhook`
2. Select events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
3. Copy the **Signing secret** (`whsec_…`) → add `STRIPE_WEBHOOK_SECRET` in Vercel → **Redeploy**.

### 5. Test the full loop
1. Visit `permit.palma.llc` → **Log In** → sign up.
2. Go to **Pricing → Start Pro** → Stripe checkout → pay (test card `4242…` in test mode).
3. Webhook fires → your Clerk user gets `plan: "pro"`.
4. On **Analyze**, upload a PDF → **Run automated deep-read** now works. A non-subscriber sees an "Upgrade" prompt instead.
5. **Manage Subscription** (footer, shown to members) opens the Stripe portal.

---

## Product note — the $3.99 single check
The deep-read is gated to **Pro/Team subscribers**. A one-time $3.99 purchase
can't unlock it without a **credit system** (track "1 deep-read remaining" per
account). Two clean options:
- **Recommended:** make the deep-read **Pro/Team only**, and drop or rebrand the single check.
- **Or later:** add a credits table (one-time purchase → +1 credit; deep-read consumes a credit). That's a small follow-on build.

## Enterprise SSO/SAML (later)
Clerk supports **SAML/SSO** on higher tiers — that's how you deliver the
"SSO/SAML authentication" promise on the Enterprise plan when you sign your
first enterprise customer. No code change to the gate; you enable it in Clerk.
