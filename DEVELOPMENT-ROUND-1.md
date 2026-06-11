# Palma Permit — Development Round 1 Summary
June 10, 2026 · Static site + Vercel serverless + Clerk + Stripe + Neon Postgres

## COMPLETED
- Log In fixed: header now links to `/sign-in`; signed-in users see a user button + Dashboard link
- Clerk publishable key embedded (`assets/auth.js`) — login/paywall now active (dev instance)
- Full auth routes: `/sign-in`, `/sign-up` (mounted Clerk components), `/login` → `/sign-in`, `/register` → `/sign-up`, `/app` → `/dashboard` redirects
- Page guards: member pages redirect signed-out users to `/sign-in?redirect=…`; auth pages redirect signed-in users to `/dashboard`
- Member dashboard (`/dashboard`): welcome, plan, report counts, quick actions, recent reports, saved searches, billing snapshot, support links, admin link for admins
- Search → report flow: `/search` form → POST `/api/searches` → creates search + report (status `processing`) → `/reports/:id` detail with placeholder copy + future PDF download slot
- Reports list (`/reports`) and detail (`/reports/:id` via rewrite to `report.html`), ownership enforced server-side
- Account page (`/account`) with mounted Clerk user profile (name/email/security)
- Billing page (`/billing`): plan status, upgrade buttons (Stripe Checkout), Stripe Customer Portal button
- Stripe success/cancel pages (`/success`, `/cancel`); checkout now points at them
- Webhook upgraded: still syncs Clerk `publicMetadata.plan`, now ALSO records `payments` + `subscriptions` rows and updates `users` in Postgres
- Neon Postgres provisioned via Vercel marketplace (`palma-permit-db`, free tier, iad1) and connected — `DATABASE_URL` auto-injected; schema auto-creates on first request (idempotent `CREATE TABLE IF NOT EXISTS`)
- Tables: users, reports, searches, payments, subscriptions, support_messages, audit_logs
- Admin area (`/admin` + `/api/admin`): summary KPIs (users/reports/searches/revenue/active subs/open support), tables for users/reports/searches/payments/subscriptions/support, report & support status editing, recent activity from audit log — gated by `ADMIN_EMAILS`
- Public pages: `/features`, `/how-it-works`, `/examples`, `/about`, `/contact` (working support form → DB), `/refund-policy`
- Nav + footer rebuilt: no dead links (audited programmatically), Get Started → `/sign-up`
- `/api/health` config check (booleans only, no secret values)
- ENV: `ADMIN_EMAILS` added in Vercel (Production + Preview)

## PARTIALLY COMPLETED
- Report generation: requests are stored and tracked; actual AI report generation is a placeholder (admin can mark complete / attach PDF URL via DB). The existing PDF deep-read on `/analyze` works for subscribers.
- Onboarding: first dashboard visit serves as onboarding; no separate `/onboarding` flow.

## NOT COMPLETED (next round)
- One-time report purchases / credit packs (schema has `credits`; needs `STRIPE_PRICE_SINGLE_REPORT` + checkout mode=payment + credit deduction)
- Automated report generation pipeline (wire `api/analyze.js` engine to stored report requests)
- PDF generation + storage for reports (Vercel Blob is a natural fit)
- Email notifications (report complete, support replies)
- Clerk production instance + `pk_live`/`sk_live` swap + DNS records (currently dev instance: works on the live domain with a dev banner + user cap)
- Stripe live mode (currently test mode end-to-end)

## NEW ROUTES CREATED
Pages: /sign-in /sign-up /dashboard /search /reports /reports/:id /account /billing /success /cancel /features /how-it-works /examples /about /contact /refund-policy /admin
APIs: /api/me /api/searches /api/reports /api/support /api/admin /api/health
Redirects: /login /register /signin /signup /app

## ROUTES FIXED
- Log In button (was `analyze.html`) → `/sign-in`
- Checkout success/cancel (was analyze/pricing query params) → `/success`, `/cancel`

## DATABASE CHANGES
- New Neon Postgres `palma-permit-db`; 7 tables (see `api/_lib/db.js`), lazily migrated, audit log on key actions

## ENV VARS (all set in Vercel)
CLERK_SECRET_KEY · STRIPE_SECRET_KEY · STRIPE_WEBHOOK_SECRET · STRIPE_PRICE_PRO · STRIPE_PRICE_TEAM · ANTHROPIC_API_KEY · DATABASE_URL (+ DATABASE_* extras, via Neon integration) · ADMIN_EMAILS
Future: STRIPE_PRICE_SINGLE_REPORT (credit packs)

## STRIPE CONFIG NEEDED LATER
- Live-mode products/prices + live webhook endpoint + live keys when leaving test mode
- (Optional) Customer Portal configuration in Stripe dashboard if not already enabled

## CLERK CONFIG NEEDED LATER
- Production instance for permit.palma.llc (DNS CNAMEs) → swap publishable key in `assets/auth.js` + `CLERK_SECRET_KEY` in Vercel

## ADMIN ACCESS
`ADMIN_EMAILS=palma9099@gmail.com,adrian@certifiedinspections.us` (comma-separated; server-enforced in `/api/admin`, UI hidden for non-admins)

## TEST RESULTS (pre-deploy)
- `node --check` on all JS: pass
- All 10 API modules import cleanly: pass
- Internal link audit across all pages + header/footer: 0 broken
- Live acceptance tests (auth flow, dashboard flow, Stripe checkout, admin) require deploy — run after push

## DEPLOYMENT
Push this directory to `main` of Palma9099/palma-permit — Vercel auto-deploys.
```
git add -A && git commit -m "Round 1: auth routes, member dashboard, reports, billing, admin, Postgres" && git push origin main
```
node_modules/ and package-lock.json are gitignored. After deploy, check https://permit.palma.llc/api/health
