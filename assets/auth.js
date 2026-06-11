/* ============================================================
   Palma Permit — front-end auth & billing (Clerk + Stripe)
   ------------------------------------------------------------
   FEATURE-FLAGGED: until you paste a real Clerk publishable key
   below, this file is a no-op and the site behaves exactly as it
   does today (deep-read shows "not enabled"). The moment a real
   key is present, login + gating + checkout activate.

   SETUP: replace CLERK_PUBLISHABLE_KEY with your key from the
   Clerk dashboard (Developers → API Keys → Publishable key).
   The publishable key is PUBLIC and safe to commit.
   ============================================================ */
(function () {
  // ---- CONFIG ----------------------------------------------------------
  const CLERK_PUBLISHABLE_KEY = "pk_test_c2V0LXNsdWctOTkuY2xlcmsuYWNjb3VudHMuZGV2JA"; // TODO: swap to pk_live_… when the Clerk production instance is created
  const PAID_PLANS = ["pro", "team"]; // publicMetadata.plan values that unlock the deep-read

  // ---- Feature flag ----------------------------------------------------
  const ENABLED = /^pk_(test|live)_/.test(CLERK_PUBLISHABLE_KEY);

  // Public API other scripts use (app.js reads window.PP.auth)
  const auth = {
    enabled: ENABLED,
    isReady: false,
    isSignedIn: () => false,
    plan: () => null,
    hasPlan: () => false,
    getToken: async () => null,
    signIn: () => {},
    signUp: () => {},
    signOut: () => {},
    startCheckout: () => {},
    openPortal: () => {},
  };
  window.PP = window.PP || {};
  window.PP.auth = auth;

  if (!ENABLED) {
    // No key configured yet — leave the site exactly as it is.
    return;
  }

  // ---- Load Clerk JS ---------------------------------------------------
  function loadClerk() {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js";
      s.async = true;
      s.crossOrigin = "anonymous";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function userPlan(u) {
    if (!u) return null;
    const pm = u.publicMetadata || {};
    // active if metadata says active (set by the Stripe webhook)
    if (pm.subStatus && !["active", "trialing"].includes(pm.subStatus)) return null;
    return pm.plan || null;
  }

  // ---- Header UI -------------------------------------------------------
  function renderHeader() {
    document.querySelectorAll(".pp-members-only").forEach((el) => { el.style.display = auth.hasPlan() ? "" : "none"; });
    const ctaWrap = document.querySelector(".nav-cta");
    if (!ctaWrap) return;
    const clerk = window.Clerk;
    if (clerk && clerk.user) {
      // Signed in: user button + Dashboard link; hide the Log In button.
      let slot = document.getElementById("pp-userbtn");
      if (!slot) {
        slot = document.createElement("div");
        slot.id = "pp-userbtn";
        slot.style.display = "flex";
        slot.style.alignItems = "center";
        ctaWrap.insertBefore(slot, ctaWrap.firstChild);
      }
      try { clerk.mountUserButton(slot, { afterSignOutUrl: "/" }); } catch (e) {}
      const login = ctaWrap.querySelector("a[data-pp-login]");
      if (login) { login.textContent = "Dashboard"; login.href = "/dashboard"; login.removeAttribute("data-pp-login"); login.__ppWired = true; }
      const nav = document.getElementById("navlinks");
      if (nav && !nav.querySelector('a[href="/dashboard"]')) {
        const a = document.createElement("a");
        a.href = "/dashboard"; a.textContent = "Dashboard";
        nav.insertBefore(a, nav.firstChild);
      }
    }
  }

  // ---- Page guards (set via <body data-pp-guard="member|guest">) -------
  function applyGuards() {
    const guard = document.body && document.body.getAttribute("data-pp-guard");
    if (!guard) return;
    const clerk = window.Clerk;
    if (guard === "member" && !(clerk && clerk.user)) {
      location.replace("/sign-in?redirect=" + encodeURIComponent(location.pathname + location.search));
    }
    if (guard === "guest" && clerk && clerk.user) {
      location.replace("/dashboard");
    }
  }

  // ---- Wire any element with data-pp-* hooks ---------------------------
  function wireHooks() {
    document.querySelectorAll("[data-pp-login]").forEach((el) => {
      if (el.__ppWired) return; el.__ppWired = true;
      el.addEventListener("click", (e) => { e.preventDefault(); auth.signIn(); });
    });
    document.querySelectorAll("[data-pp-checkout]").forEach((el) => {
      if (el.__ppWired) return; el.__ppWired = true;
      el.addEventListener("click", (e) => { e.preventDefault(); auth.startCheckout(el.getAttribute("data-pp-checkout") || "pro"); });
    });
    document.querySelectorAll("[data-pp-portal]").forEach((el) => {
      if (el.__ppWired) return; el.__ppWired = true;
      el.addEventListener("click", (e) => { e.preventDefault(); auth.openPortal(); });
    });
  }

  // ---- Init ------------------------------------------------------------
  async function init() {
    try {
      await loadClerk();
      const clerk = new window.Clerk(CLERK_PUBLISHABLE_KEY);
      await clerk.load({});
      window.Clerk = clerk;

      auth.isReady = true;
      auth.isSignedIn = () => !!clerk.user;
      auth.plan = () => userPlan(clerk.user);
      auth.hasPlan = () => PAID_PLANS.includes(userPlan(clerk.user));
      auth.getToken = async () => { try { return clerk.session ? await clerk.session.getToken() : null; } catch (e) { return null; } };
      auth.signIn = () => clerk.openSignIn({ afterSignInUrl: "/dashboard", afterSignUpUrl: "/dashboard" });
      auth.signUp = () => clerk.openSignUp({ afterSignInUrl: "/dashboard", afterSignUpUrl: "/dashboard" });
      auth.signOut = () => clerk.signOut();
      auth.user = () => clerk.user || null;
      auth.apiFetch = async (url, opts) => {
        const token = await auth.getToken();
        const o = opts || {};
        o.headers = Object.assign({}, o.headers, token ? { Authorization: "Bearer " + token } : {});
        if (o.body && !o.headers["Content-Type"]) o.headers["Content-Type"] = "application/json";
        const r = await fetch(url, o);
        let data = null;
        try { data = await r.json(); } catch (e) { data = {}; }
        return { ok: r.ok, status: r.status, data };
      };

      auth.startCheckout = async (planKey) => {
        if (!clerk.user) { auth.signIn(); return; }
        try {
          const token = await auth.getToken();
          const res = await fetch("/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
            body: JSON.stringify({ plan: planKey, returnUrl: location.origin + "/analyze.html" }),
          });
          const data = await res.json();
          if (data.url) location.href = data.url;
          else alert(data.message || "Could not start checkout.");
        } catch (e) { alert("Checkout error: " + e.message); }
      };

      auth.openPortal = async () => {
        try {
          const token = await auth.getToken();
          const res = await fetch("/api/portal", { method: "POST", headers: { Authorization: "Bearer " + token } });
          const data = await res.json();
          if (data.url) location.href = data.url; else alert(data.message || "No billing portal available.");
        } catch (e) { alert("Portal error: " + e.message); }
      };

      // React to auth changes
      clerk.addListener(() => { renderHeader(); document.dispatchEvent(new CustomEvent("pp-auth-changed")); });
      renderHeader();
      wireHooks();
      applyGuards();
      document.dispatchEvent(new CustomEvent("pp-auth-ready"));
    } catch (e) {
      console.warn("[PalmaPermit] Clerk init failed:", e);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
