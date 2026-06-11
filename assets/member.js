/* ============================================================
   Palma Permit — member area (dashboard, search, reports,
   account, billing, admin, auth pages). Driven by
   <body data-pp-page="..."> and window.PP.auth from auth.js.
   ============================================================ */
(function () {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = (d) => { try { return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); } catch (e) { return ""; } };
  const STATUS_COLORS = { complete: "var(--success)", processing: "var(--warn)", needs_review: "var(--warn)", failed: "#e5484d", draft: "var(--muted)", pending_payment: "var(--warn)", submitted: "var(--warn)", open: "var(--warn)", closed: "var(--success)" };
  const badge = (s) => `<span class="tag" style="color:${STATUS_COLORS[s] || "var(--muted)"}">${esc(String(s || "").replace(/_/g, " "))}</span>`;
  const planLabel = (p) => (p === "pro" ? "Pro" : p === "team" ? "Team" : "Free");

  function authed() { return window.PP && window.PP.auth && window.PP.auth.isReady && window.PP.auth.isSignedIn(); }
  async function api(url, opts) { return window.PP.auth.apiFetch(url, opts); }
  function setMsg(el, text, isErr) { if (el) { el.textContent = text; el.style.color = isErr ? "#e5484d" : "var(--success)"; } }

  /* ---------- auth pages ---------- */
  function pageSignIn(mode) {
    const slot = $("#clerk-slot");
    if (!slot || !window.Clerk) return;
    const redirect = new URLSearchParams(location.search).get("redirect") || "/dashboard";
    const opts = { afterSignInUrl: redirect, afterSignUpUrl: "/dashboard", signUpUrl: "/sign-up", signInUrl: "/sign-in" };
    try {
      if (mode === "up") window.Clerk.mountSignUp(slot, opts);
      else window.Clerk.mountSignIn(slot, opts);
    } catch (e) {
      slot.innerHTML = '<p class="muted">Could not load the sign-in form. <a href="/contact">Contact support</a>.</p>';
    }
  }

  /* ---------- dashboard ---------- */
  async function pageDashboard() {
    const r = await api("/api/me");
    if (!r.ok) { setMsg($("#dash-msg"), "Could not load your account (" + r.status + ").", true); return; }
    const me = r.data;
    $("#dash-welcome").textContent = "Welcome" + (me.name ? ", " + me.name.split(" ")[0] : "") + ".";
    $("#dash-email").textContent = me.email || "";
    $("#dash-plan").textContent = planLabel(me.plan);
    $("#dash-credits").textContent = me.plan ? "Unlimited (subscriber)" : String(me.credits || 0) + " credits";
    $("#dash-counts").textContent = me.counts.reports + " reports · " + me.counts.searches + " searches";
    if (me.isAdmin) { const a = $("#dash-admin-link"); if (a) a.style.display = ""; }
    const up = $("#dash-upgrade"); if (up && me.plan) up.style.display = "none";
    const mb = $("#dash-manage"); if (mb && !me.plan) mb.style.display = "none";

    const list = $("#dash-reports");
    if (me.recentReports && me.recentReports.length) {
      list.innerHTML = me.recentReports.map((x) => `
        <a class="card pad row-item" href="/reports/${x.id}">
          <div><b>${esc(x.address)}</b><div class="muted" style="font-size:.9rem">${esc(x.city)} · ${esc(x.project_type || "general")} · ${fmtDate(x.created_at)}</div></div>
          ${badge(x.status)}
        </a>`).join("");
    } else {
      list.innerHTML = '<p class="muted">No reports yet — start your first search above.</p>';
    }
    const sl = $("#dash-searches");
    if (me.recentSearches && me.recentSearches.length) {
      sl.innerHTML = me.recentSearches.map((x) => `
        <div class="card pad row-item"><div><b>${esc(x.address)}</b>
          <div class="muted" style="font-size:.9rem">${esc(x.city)} · ${fmtDate(x.created_at)}</div></div>${badge(x.status)}</div>`).join("");
    } else {
      sl.innerHTML = '<p class="muted">No saved searches yet.</p>';
    }
  }

  /* ---------- new search ---------- */
  function pageSearch() {
    const form = $("#search-form");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("#search-submit");
      btn.disabled = true; btn.textContent = "Submitting…";
      const body = {
        address: $("#f-address").value, city: $("#f-city").value, state: $("#f-state").value,
        propertyType: $("#f-property").value, projectType: $("#f-project").value, permitQuestion: $("#f-question").value,
      };
      const r = await api("/api/searches", { method: "POST", body: JSON.stringify(body) });
      if (r.ok) { location.href = "/reports/" + r.data.reportId; return; }
      setMsg($("#search-msg"), (r.data && r.data.message) || "Could not submit (" + r.status + ").", true);
      btn.disabled = false; btn.textContent = "Submit search";
    });
  }

  /* ---------- reports list ---------- */
  async function pageReports() {
    const r = await api("/api/reports");
    const list = $("#reports-list");
    if (!r.ok) { list.innerHTML = '<p class="muted">Could not load reports (' + r.status + ").</p>"; return; }
    const rows = r.data.reports || [];
    if (!rows.length) { list.innerHTML = '<p class="muted">No reports yet. <a href="/search">Start a search →</a></p>'; return; }
    list.innerHTML = rows.map((x) => `
      <a class="card pad row-item" href="/reports/${x.id}">
        <div><b>${esc(x.address)}</b>
          <div class="muted" style="font-size:.9rem">${esc(x.city)}, ${esc(x.state)} · ${esc(x.report_type || "")} · ${fmtDate(x.created_at)}</div></div>
        ${badge(x.status)}
      </a>`).join("");
  }

  /* ---------- report detail ---------- */
  async function pageReport() {
    const m = location.pathname.match(/\/reports\/(\d+)/);
    const id = (m && m[1]) || new URLSearchParams(location.search).get("id");
    const box = $("#report-box");
    if (!id) { box.innerHTML = '<p class="muted">Report not found. <a href="/reports">Back to reports</a></p>'; return; }
    const r = await api("/api/reports?id=" + encodeURIComponent(id));
    if (!r.ok) { box.innerHTML = '<p class="muted">' + (r.status === 404 ? "Report not found." : "Could not load this report (" + r.status + ").") + ' <a href="/reports">Back to reports</a></p>'; return; }
    const x = r.data.report;
    $("#report-title").textContent = x.address;
    box.innerHTML = `
      <div class="card pad-lg">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <div><b>${esc(x.address)}</b><div class="muted">${esc(x.city)}, ${esc(x.state)} · ${esc(x.project_type || "general")} · requested ${fmtDate(x.created_at)}</div></div>
          ${badge(x.status)}
        </div>
        <hr style="border-color:var(--border,#243049);margin:16px 0">
        <p>${esc(x.summary || "Your report request has been received. Palma Permit is processing this report.")}</p>
        ${x.pdf_url ? `<a class="btn btn-primary" href="${esc(x.pdf_url)}" target="_blank" rel="noopener">Download PDF</a>` : '<p class="muted" style="font-size:.9rem">You\'ll be able to download the PDF here once the report is complete.</p>'}
      </div>`;
  }

  /* ---------- account ---------- */
  async function pageAccount() {
    const r = await api("/api/me");
    if (!r.ok) return;
    const me = r.data;
    $("#acct-name").textContent = me.name || "—";
    $("#acct-email").textContent = me.email || "—";
    $("#acct-plan").textContent = planLabel(me.plan) + (me.subStatus && me.plan ? " (" + me.subStatus + ")" : "");
    const slot = $("#clerk-profile");
    if (slot && window.Clerk) { try { window.Clerk.mountUserProfile(slot); } catch (e) {} }
  }

  /* ---------- billing ---------- */
  async function pageBilling() {
    const r = await api("/api/me");
    if (!r.ok) return;
    const me = r.data;
    $("#bill-plan").textContent = planLabel(me.plan);
    $("#bill-status").textContent = me.plan ? (me.subStatus || "active") : "No active subscription";
    if (me.plan) { $("#bill-upgrade-wrap").style.display = "none"; }
    else { $("#bill-portal-wrap").style.display = "none"; }
  }

  /* ---------- success ---------- */
  async function pageSuccess() {
    // Plan is granted by the Stripe webhook; refresh state shortly after landing.
    setTimeout(async () => {
      try { if (window.Clerk && window.Clerk.user) await window.Clerk.user.reload(); } catch (e) {}
      const r = await api("/api/me");
      if (r.ok && r.data.plan) $("#success-plan").textContent = "Your " + planLabel(r.data.plan) + " plan is active.";
    }, 1500);
  }

  /* ---------- contact (public) ---------- */
  function pageContact() {
    const form = $("#contact-form");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("#contact-submit");
      btn.disabled = true; btn.textContent = "Sending…";
      const body = { name: $("#c-name").value, email: $("#c-email").value, message: $("#c-message").value };
      let r;
      if (authed()) r = await api("/api/support", { method: "POST", body: JSON.stringify(body) });
      else {
        const raw = await fetch("/api/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        r = { ok: raw.ok, status: raw.status, data: await raw.json().catch(() => ({})) };
      }
      if (r.ok) { form.style.display = "none"; setMsg($("#contact-msg"), "Message received — we'll get back to you shortly."); }
      else { setMsg($("#contact-msg"), (r.data && r.data.message) || "Could not send (" + r.status + ").", true); btn.disabled = false; btn.textContent = "Send message"; }
    });
  }

  /* ---------- admin ---------- */
  async function pageAdmin() {
    const me = await api("/api/me");
    if (!me.ok || !me.data.isAdmin) { $("#admin-root").innerHTML = '<p class="muted">You do not have access to this page.</p>'; return; }
    const views = ["summary", "users", "reports", "searches", "payments", "subscriptions", "support"];
    const tabs = $("#admin-tabs");
    tabs.innerHTML = views.map((v, i) => `<button class="btn ${i ? "btn-ghost" : "btn-primary"}" data-v="${v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join(" ");
    async function load(view) {
      tabs.querySelectorAll("button").forEach((b) => b.className = "btn " + (b.dataset.v === view ? "btn-primary" : "btn-ghost"));
      const out = $("#admin-out");
      out.innerHTML = '<p class="muted">Loading…</p>';
      const r = await api("/api/admin?view=" + view);
      if (!r.ok) { out.innerHTML = '<p class="muted">Error ' + r.status + "</p>"; return; }
      if (view === "summary") {
        const d = r.data;
        out.innerHTML = `<div class="grid grid-3">
          <div class="card pad"><h3>Users</h3><p style="font-size:1.6rem"><b>${d.users}</b></p></div>
          <div class="card pad"><h3>Reports</h3><p style="font-size:1.6rem"><b>${d.reports}</b></p></div>
          <div class="card pad"><h3>Searches</h3><p style="font-size:1.6rem"><b>${d.searches}</b></p></div>
          <div class="card pad"><h3>Active subs</h3><p style="font-size:1.6rem"><b>${d.activeSubs}</b></p></div>
          <div class="card pad"><h3>Revenue</h3><p style="font-size:1.6rem"><b>$${(d.revenueCents / 100).toFixed(2)}</b></p></div>
          <div class="card pad"><h3>Open support</h3><p style="font-size:1.6rem"><b>${d.openSupport}</b></p></div>
        </div>
        <h3 style="margin-top:24px">Recent activity</h3>
        ${(d.recentActivity || []).map((a) => `<div class="muted" style="font-size:.9rem;padding:4px 0">${fmtDate(a.created_at)} — ${esc(a.action)} ${esc(JSON.stringify(a.metadata || {}))}</div>`).join("") || '<p class="muted">None yet.</p>'}`;
        return;
      }
      const rows = r.data.rows || [];
      if (!rows.length) { out.innerHTML = '<p class="muted">Nothing here yet.</p>'; return; }
      const cols = Object.keys(rows[0]).filter((c) => c !== "query_payload");
      out.innerHTML = `<div style="overflow-x:auto"><table class="admin-table"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}${view === "reports" || view === "support" ? "<th>actions</th>" : ""}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${cols.map((c) => `<td>${c.endsWith("_at") ? fmtDate(row[c]) : esc(String(row[c] == null ? "" : row[c])).slice(0, 80)}</td>`).join("")}
          ${view === "reports" ? `<td><select data-id="${row.id}" data-kind="report.status"><option></option>${["processing", "complete", "failed", "needs_review"].map((s) => `<option ${row.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></td>` : ""}
          ${view === "support" ? `<td><select data-id="${row.id}" data-kind="support.status"><option></option>${["open", "in_progress", "closed"].map((s) => `<option ${row.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></td>` : ""}
        </tr>`).join("")}</tbody></table></div>`;
      out.querySelectorAll("select[data-kind]").forEach((sel) => {
        sel.addEventListener("change", async () => {
          if (!sel.value) return;
          await api("/api/admin", { method: "POST", body: JSON.stringify({ action: sel.dataset.kind, id: parseInt(sel.dataset.id, 10), status: sel.value }) });
          load(view);
        });
      });
    }
    tabs.addEventListener("click", (e) => { const v = e.target && e.target.dataset && e.target.dataset.v; if (v) load(v); });
    load("summary");
  }

  /* ---------- router ---------- */
  function run() {
    const page = document.body.getAttribute("data-pp-page");
    if (!page) return;
    const memberPages = { dashboard: pageDashboard, search: pageSearch, reports: pageReports, report: pageReport, account: pageAccount, billing: pageBilling, admin: pageAdmin, success: pageSuccess };
    if (page === "sign-in") return pageSignIn("in");
    if (page === "sign-up") return pageSignIn("up");
    if (page === "contact") return pageContact();
    const fn = memberPages[page];
    if (fn) { if (authed() || page === "success") fn(); }
  }

  if (window.PP && window.PP.auth && window.PP.auth.isReady) run();
  else document.addEventListener("pp-auth-ready", run);
  // If Clerk never loads (misconfig), show a hint on auth pages instead of a blank box.
  setTimeout(() => {
    const page = document.body.getAttribute("data-pp-page");
    if ((page === "sign-in" || page === "sign-up") && !(window.PP && window.PP.auth && window.PP.auth.isReady)) {
      const slot = $("#clerk-slot");
      if (slot && !slot.childElementCount) slot.innerHTML = '<p class="muted">Sign-in is temporarily unavailable. Please try again shortly or <a href="/contact">contact support</a>.</p>';
    }
  }, 6000);
})();
