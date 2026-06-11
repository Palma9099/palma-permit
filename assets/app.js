/* ============================================================
   Palma Permit — app shell + analyzer engine
   ============================================================ */
(function () {
  const LOGO = `<svg class="logo" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="2" y="2" width="36" height="36" rx="10" fill="#0f1626" stroke="#243049"/>
    <path d="M13 27V13h6.2c3.1 0 5.1 1.9 5.1 4.8 0 2.9-2 4.8-5.1 4.8H16.4V27H13z" fill="#f2a93b"/>
    <path d="M24.5 27l3.2-8h.2l3.2 8h-2.3l-.5-1.4h-2.9L26.8 27h-2.3z" fill="#4cc9b0"/>
  </svg>`;

  function header(active) {
    const link = (href, label) =>
      `<a href="${href}"${active === label ? ' style="color:var(--text)"' : ''}>${label}</a>`;
    return `<header class="site-header"><div class="wrap nav">
      <a class="brand" href="index.html">${LOGO}<span>Palma <span class="accent">Permit</span></span></a>
      <nav class="nav-links" id="navlinks">
        ${link('/analyze','Analyze')}
        ${link('/features','Features')}
        ${link('/how-it-works','How It Works')}
        ${link('/pricing','Pricing')}
        ${link('/contact','Contact')}
      </nav>
      <div class="nav-cta">
        <a class="btn btn-ghost" href="/sign-in" data-pp-login>Log In</a>
        <a class="btn btn-primary" href="/sign-up">Get Started</a>
        <button class="nav-toggle" aria-label="Menu" onclick="document.getElementById('navlinks').classList.toggle('open')">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
      </div>
    </div></header>`;
  }

  function footer() {
    return `<footer class="site-footer"><div class="wrap">
      <div class="footer-grid">
        <div>
          <a class="brand" href="index.html">${LOGO}<span>Palma <span class="accent">Permit</span></span></a>
          <p style="margin-top:14px;max-width:34ch">Automated pre-submission compliance for Florida commercial contractors. Standardize your quality controls before the building department reviews.</p>
        </div>
        <div><h4>Product</h4>
          <a href="/analyze">Analyze a Package</a>
          <a href="/features">Features</a>
          <a href="/examples">Example Reports</a>
          <a href="/cities">Cities We Cover</a>
          <a href="/pricing">Pricing</a>
          <a href="/faq">FAQ</a>
        </div>
        <div><h4>Company</h4>
          <a href="/how-it-works">How It Works</a>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
          <a href="/sign-up">Create Account</a>
          <a href="#" class="pp-members-only" data-pp-portal>Manage Subscription</a>
        </div>
        <div><h4>Legal</h4>
          <a href="/faq#disclaimer">Disclaimer</a>
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <a href="/refund-policy">Refund Policy</a>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© 2026 Palma Permit · palma.llc · Serving Florida</span>
        <span>🔒 SOC 2 Type II Certified Infrastructure · Enterprise-grade data encryption</span>
      </div>
    </div></footer>`;
  }

  function mountChrome(active) {
    const h = document.getElementById('app-header');
    const f = document.getElementById('app-footer');
    if (h) h.outerHTML = header(active);
    if (f) f.outerHTML = footer();
  }

  // ---------- Cities page ----------
  function renderCities() {
    const grid = document.getElementById('city-grid');
    if (!grid) return;
    const D = window.PP_DATA;
    let county = 'All';
    let q = '';
    function draw() {
      const list = D.cities.filter(c =>
        (county === 'All' || c.county === county) &&
        (!q || c.name.toLowerCase().includes(q)));
      grid.innerHTML = list.map(c => `
        <a class="city-card" href="analyze.html?city=${c.slug}">
          <div class="nm">${c.name}</div>
          <div class="meta">${c.county} County · ${c.t} permit types · ${c.i} requirements</div>
          <div class="badges">
            <span class="minibadge">${c.g} gotchas</span>
            ${c.hvhz ? '<span class="minibadge hvhz">HVHZ</span>' : ''}
            <span class="minibadge">${c.portal}</span>
          </div>
        </a>`).join('') ||
        '<p class="muted">No cities match your search.</p>';
      const nr = document.getElementById('city-count');
      if (nr) nr.textContent = list.length;
    }
    document.querySelectorAll('[data-county]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('[data-county]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        county = chip.dataset.county; draw();
      });
    });
    const search = document.getElementById('city-search');
    if (search) search.addEventListener('input', e => { q = e.target.value.toLowerCase(); draw(); });
    draw();
  }

  // ---------- Analyzer ----------
  function initAnalyzer() {
    const root = document.getElementById('analyzer');
    if (!root) return;
    const D = window.PP_DATA;
    const citySel = document.getElementById('a-city');
    const typeSel = document.getElementById('a-type');
    const checklist = document.getElementById('a-checklist');
    const report = document.getElementById('a-report');

    // populate selects
    const byCounty = { Broward: [], "Palm Beach": [], "Miami-Dade": [] };
    D.cities.forEach(c => byCounty[c.county].push(c));
    citySel.innerHTML = '<option value="">Select your city…</option>' +
      Object.entries(byCounty).map(([cn, arr]) =>
        `<optgroup label="${cn} County">` +
        arr.map(c => `<option value="${c.slug}">${c.name}</option>`).join('') +
        `</optgroup>`).join('');
    typeSel.innerHTML = '<option value="">Select permit type…</option>' +
      D.permitTypes.map(p => `<option value="${p.id}">${p.label}</option>`).join('');

    // preselect from ?city=
    const params = new URLSearchParams(location.search);
    if (params.get('city')) citySel.value = params.get('city');

    let checked = {};

    function buildChecklist() {
      checked = {};
      const city = D.cityBySlug(citySel.value);
      const type = D.permitById(typeSel.value);
      if (!city || !type) {
        checklist.innerHTML = '<p class="muted" style="padding:20px 4px">Select a city and permit type to load the exact document checklist.</p>';
        report.innerHTML = reportEmpty();
        return;
      }
      const docs = type.docs
        .map(id => D.docById(id))
        .filter(d => d && (!d.hvhzOnly || city.hvhz));
      checklist.innerHTML = docs.map(d => `
        <label class="check">
          <input type="checkbox" data-id="${d.id}" data-crit="${d.critical}">
          <div>
            <div class="lab">${d.label}
              ${d.critical ? '<span class="crit"> · REQUIRED</span>' : '<span class="ok"> · recommended</span>'}</div>
            <div class="tip">${d.tip}</div>
          </div>
        </label>`).join('');
      checklist.querySelectorAll('input').forEach(inp =>
        inp.addEventListener('change', () => { checked[inp.dataset.id] = inp.checked; score(); }));
      score();
    }

    function score() {
      const city = D.cityBySlug(citySel.value);
      const type = D.permitById(typeSel.value);
      if (!city || !type) return;
      const docs = type.docs.map(id => D.docById(id)).filter(d => d && (!d.hvhzOnly || city.hvhz));
      const total = docs.length;
      const have = docs.filter(d => checked[d.id]).length;
      const missingCritical = docs.filter(d => d.critical && !checked[d.id]);
      const missingRec = docs.filter(d => !d.critical && !checked[d.id]);
      const pct = Math.round((have / total) * 100);

      let verdict, color;
      if (missingCritical.length === 0 && missingRec.length === 0) { verdict = "Ready to submit"; color = "green"; }
      else if (missingCritical.length === 0) { verdict = "Submit-ready — recommended items still open"; color = "amber"; }
      else { verdict = `${missingCritical.length} required item${missingCritical.length>1?'s':''} missing — likely rejection`; color = "red"; }

      const gotchas = D.gotchasFor(city.slug);
      report.innerHTML = `
        <div class="card pad-lg">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <strong>Readiness report</strong>
            <span class="tag ${color==='green'?'green':'amber'}">${city.name}</span>
          </div>
          <div class="score-ring">
            <div class="ring" style="--p:${pct}"><div class="inner">${pct}%</div></div>
            <div>
              <div class="verdict" style="color:var(--${color==='red'?'danger':color==='amber'?'warn':'success'})">${verdict}</div>
              <div class="muted" style="font-size:.9rem;margin-top:4px">${have} of ${total} items confirmed · ${type.label}</div>
            </div>
          </div>
          ${(missingCritical.length||missingRec.length) ? '<ul>' +
            missingCritical.map(d => `<li class="miss"><span class="dot red"></span><div><b>${d.label}</b><div class="tip">${d.tip}</div></div></li>`).join('') +
            missingRec.map(d => `<li><span class="dot amber"></span><div>${d.label}<div class="tip">${d.tip}</div></div></li>`).join('') +
            '</ul>' : '<ul><li><span class="dot green"></span>All tracked documents confirmed. Double-check the city gotchas below before filing.</li></ul>'}
          <div class="gotcha-box">
            <h4>${city.name} known gotchas</h4>
            <ul>${gotchas.map(g => `<li>${g}</li>`).join('')}</ul>
          </div>
          <p class="tip" style="margin-top:14px">Filing portal: ${city.portal}${city.phone ? ` · Building dept: ${city.phone}` : ''}</p>
        </div>`;
    }

    function reportEmpty() {
      return `<div class="card pad-lg center" style="padding:48px 26px">
        <div class="icon-badge teal" style="margin:0 auto 14px">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        </div>
        <h3>Your report appears here</h3>
        <p class="muted">Pick a city and permit type, then check off the documents you already have. We'll score your package and flag rejection risks instantly.</p>
      </div>`;
    }

    citySel.addEventListener('change', buildChecklist);
    typeSel.addEventListener('change', buildChecklist);
    buildChecklist();

    // ---- AI deep-read (Pro) ----
    initAiDeepRead(citySel, typeSel, report);
  }

  function initAiDeepRead(citySel, typeSel, report) {
    const fileInput = document.getElementById('a-files');
    const fileList = document.getElementById('a-files-list');
    const runBtn = document.getElementById('a-ai-run');
    const status = document.getElementById('a-ai-status');
    if (!fileInput || !runBtn) return;
    const D = window.PP_DATA;
    let files = [];

    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    fileInput.addEventListener('change', () => {
      files = Array.from(fileInput.files || []);
      fileList.textContent = files.length ? files.map(f => f.name).join(', ') : '';
      runBtn.disabled = !files.length;
    });

    async function readText(file) {
      if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        if (!window.pdfjsLib) return '(PDF text extraction unavailable)';
        const buf = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
        let out = '';
        for (let i = 1; i <= Math.min(pdf.numPages, 15); i++) {
          const page = await pdf.getPage(i);
          const tc = await page.getTextContent();
          out += tc.items.map(it => it.str).join(' ') + '\n';
        }
        return out;
      }
      return await file.text();
    }

    function upgradeLink(msg) {
      status.innerHTML = msg + ' ';
      const A = window.PP && window.PP.auth;
      const a = document.createElement('a');
      a.href = 'pricing.html'; a.className = 'accent'; a.textContent = 'Upgrade →';
      if (A && A.isReady) a.onclick = (e) => { e.preventDefault(); A.startCheckout('pro'); };
      status.appendChild(a);
    }

    runBtn.addEventListener('click', async () => {
      const city = D.cityBySlug(citySel.value);
      const type = D.permitById(typeSel.value);
      if (!city || !type) { status.textContent = 'Pick a city and permit type first.'; return; }
      // Phase 2 gate (only active when Clerk auth is configured)
      const A = window.PP && window.PP.auth;
      if (A && A.isReady) {
        if (!A.isSignedIn()) { status.textContent = 'Sign in to run an automated deep-read…'; A.signIn(); return; }
        if (!A.hasPlan()) { upgradeLink('Automated deep-read is a Pro/Team feature.'); return; }
      }
      runBtn.disabled = true; status.textContent = 'Reading your documents…';
      try {
        const documents = [];
        for (const f of files) {
          status.textContent = `Reading ${f.name}…`;
          documents.push({ name: f.name, text: (await readText(f)).slice(0, 8000) });
        }
        const requiredDocs = type.docs
          .map(id => D.docById(id))
          .filter(d => d && (!d.hvhzOnly || city.hvhz))
          .map(d => d.label);
        status.textContent = 'Running automated audit…';
        const headers = { 'Content-Type': 'application/json' };
        if (A && A.isReady) { const t = await A.getToken(); if (t) headers['Authorization'] = 'Bearer ' + t; }
        const res = await fetch('/api/analyze', {
          method: 'POST', headers,
          body: JSON.stringify({ city: city.name, permitType: type.label, requiredDocs, documents }),
        });
        const data = await res.json();
        if (res.status === 401) { status.textContent = data.message || 'Please sign in.'; if (A && A.isReady) A.signIn(); runBtn.disabled = false; return; }
        if (res.status === 402) { upgradeLink(data.message || 'An active plan is required.'); runBtn.disabled = false; return; }
        if (res.status === 503 || data.error === 'not_configured') {
          status.innerHTML = 'Automated deep-read isn\'t enabled on this deployment yet. The free checklist above still works — set <code>ANTHROPIC_API_KEY</code> on your host to turn this on.';
          runBtn.disabled = false; return;
        }
        if (!res.ok) { status.textContent = 'Engine error: ' + (data.message || res.status); runBtn.disabled = false; return; }
        renderAi(data, city, type, report);
        status.textContent = '';
      } catch (e) {
        status.textContent = 'Could not run automated deep-read: ' + e.message;
      } finally {
        runBtn.disabled = false;
      }
    });

    function renderAi(data, city, type, report) {
      const pct = (typeof data.compliance === 'number') ? data.compliance : 0;
      const items = data.items || [];
      const color = pct >= 95 ? 'green' : pct >= 70 ? 'amber' : 'red';
      const dot = s => s === 'found' ? 'green' : s === 'attention' ? 'amber' : 'red';
      report.innerHTML = `
        <div class="card pad-lg">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <strong>Automated deep-read report</strong><span class="tag amber">${city.name} · Engine</span>
          </div>
          <div class="score-ring">
            <div class="ring" style="--p:${pct}"><div class="inner">${pct}%</div></div>
            <div><div class="verdict" style="color:var(--${color==='red'?'danger':color==='amber'?'warn':'success'})">${data.verdict || ''}</div>
            <div class="muted" style="font-size:.9rem;margin-top:4px">${type.label} · read from your uploaded files</div></div>
          </div>
          <ul>${items.map(it => `<li><span class="dot ${dot(it.status)}"></span><div><b>${it.doc}</b><div class="tip">${it.note||''}</div></div></li>`).join('')}</ul>
          <div class="gotcha-box"><h4>${city.name} known gotchas</h4>
            <ul>${D.gotchasFor(city.slug).map(g => `<li>${g}</li>`).join('')}</ul></div>
        </div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    mountChrome(document.body.dataset.page || '');
    renderCities();
    initAnalyzer();
  });
})();
