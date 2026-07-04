#!/usr/bin/env node
// Programmatic hyper-local landing pages for Palma.
//
// Reads data/locations.json and emits one static HTML page per metro at
// locations/<slug>.html. Static output = perfect Core Web Vitals (no client
// framework, no layout shift) while giving Google hyper-local keyword and
// schema signals. To add a market: add an object to data/locations.json and
// re-run `node scripts/gen-locations.mjs`.
//
// Usage:
//   node scripts/gen-locations.mjs          # generate pages
//   node scripts/gen-locations.mjs --links  # also print footer + sitemap snippets

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA = resolve(ROOT, 'data/locations.json');
const OUT_DIR = resolve(ROOT, 'locations');

const GA_ID = 'G-D1NHS1GBDL';
const PHONE = '305-393-0690';
const PHONE_TEL = '+13053930690';
const OG_IMAGE = 'https://palma.llc/images/hero/stages/s9.jpg';

// HTML-escape for text nodes / attribute values.
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// "a" vs "an" based on the leading sound of the following word.
const article = (word) => (/^[aeiou]/i.test(String(word).trim()) ? 'an' : 'a');

function renderNearby(loc) {
  if (!Array.isArray(loc.nearby) || !loc.nearby.length) return '';
  const list = loc.nearby.map((n) => esc(n)).join(', ');
  return `Palma also serves ${list}, and the rest of ${esc(loc.countyName)}.`;
}

function jsonLd(loc) {
  const url = `https://palma.llc/locations/${loc.slug}`;
  const localBusiness = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: `Palma Building Solutions - ${loc.cityName} Region`,
    description: `Florida's permitting and compliance concierge in ${loc.cityName} and ${loc.countyName}.`,
    telephone: PHONE,
    url,
    image: OG_IMAGE,
    address: { '@type': 'PostalAddress', addressRegion: 'FL', addressLocality: loc.cityName },
    areaServed: [
      { '@type': 'AdministrativeArea', name: loc.countyName },
      { '@type': 'AdministrativeArea', name: loc.cityName },
    ],
  };
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems(loc).map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://palma.llc/' },
      { '@type': 'ListItem', position: 2, name: 'Service areas', item: 'https://palma.llc/locations' },
      { '@type': 'ListItem', position: 3, name: `${loc.cityName}, FL` },
    ],
  };
  // Compact, no unescaped </script> risk (JSON.stringify escapes nothing that breaks it here).
  return JSON.stringify([localBusiness, faq, breadcrumb]);
}

function faqItems(loc) {
  return [
    {
      q: `Does Palma handle permits and code violations in ${loc.cityName}?`,
      a: `Yes. Palma coordinates permitting and compliance work throughout ${loc.cityName} and ${loc.countyName}, and connects you with independently licensed Florida engineers and contractors who perform the work.`,
    },
    {
      q: `Which building department handles ${loc.cityName}?`,
      a: `Most ${loc.countyName} work runs through the ${loc.buildingDeptName}, though incorporated cities often permit on their own portals. We confirm which authority holds your record before doing anything else.`,
    },
    {
      q: `Is Palma a contractor or engineer?`,
      a: `No. Palma Building Solutions is a permitting and project-coordination company. The engineering and construction are performed by a vetted network of independently licensed Florida professionals.`,
    },
  ];
}

function faqHtml(loc) {
  return faqItems(loc)
    .map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`)
    .join('');
}

function otherLinks(all, current, max = 9) {
  // Region-first internal linking: surface same-region metros before the rest,
  // capped so the block stays a clean, relevant mesh rather than a link dump.
  const others = all.filter((l) => l.slug !== current.slug);
  const sameRegion = others.filter((l) => l.region === current.region);
  const rest = others.filter((l) => l.region !== current.region);
  const ordered = [...sameRegion, ...rest].slice(0, max);
  return ordered
    .map(
      (l) =>
        `<a href="/locations/${l.slug}">Permits &amp; compliance in ${esc(l.cityName)} (${esc(
          l.countyName.replace(/ County$/, ''),
        )})</a>`,
    )
    .join('');
}

function page(loc, all) {
  const url = `https://palma.llc/locations/${loc.slug}`;
  const title = `${loc.cityName} Building Permits & Code Violation Resolution | Palma`;
  const h1 = `Navigating Permits & Compliance in ${loc.cityName} and ${loc.countyName}.`;
  const toolPlaceholder = `Enter ${article(loc.cityName)} ${loc.cityName} property address or folio…`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(loc.metaDescription)}" />
<link rel="canonical" href="${url}" />
<meta name="theme-color" content="#f6f2e9" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');window.track=function(n,p){try{gtag('event',n,p||{});}catch(e){}};</script>
<meta property="og:type" content="website" />
<meta property="og:url" content="${url}" />
<meta property="og:title" content="${esc(loc.heroTitle)}" />
<meta property="og:description" content="${esc(loc.metaDescription)}" />
<meta property="og:image" content="${OG_IMAGE}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(loc.heroTitle)}" />
<meta name="twitter:image" content="${OG_IMAGE}" />
<script type="application/ld+json">${jsonLd(loc)}</script>
<link rel="stylesheet" href="/svc.css" />
<style>
  .lookup{background:var(--ink2);color:var(--paper);border-radius:14px;padding:28px 30px;margin-top:28px;max-width:860px}
  .lookup .lab{color:#e7b9a6;font-size:12px;letter-spacing:.16em;font-weight:700;text-transform:uppercase}
  .lookup b{display:block;font-family:"Fraunces",Georgia,serif;font-weight:500;color:#fff;font-size:22px;margin:10px 0 6px}
  .lookup p{color:#c9c1b1;font-size:14.5px;line-height:1.55;margin:0 0 16px;max-width:640px}
  .lookup .row{display:flex;gap:10px;flex-wrap:wrap}
  .lookup input{flex:1;min-width:220px;background:#322d22;border:1px solid #4a4435;color:#fff;border-radius:8px;padding:13px 14px;font-size:15px}
  .lookup input::placeholder{color:#9a9486}
  .lookup button{background:var(--accent);color:#fff;font-weight:600;border:0;border-radius:8px;padding:13px 22px;font-size:15px;cursor:pointer}
  .lookup button:hover{background:var(--accent2)}
  .lookup .fine{color:#9a9486;font-size:12.5px;margin-top:12px}
</style>
</head>
<body>
<nav>
  <a class="brand" href="/"><span class="mark">▲</span><b>PALMA</b><span>BUILDING SOLUTIONS</span></a>
  <div class="navlinks"><a href="/services">Services</a><a href="/#tool">Tools</a><a href="/how-it-works">How it works</a><a href="#estimate">Contact</a><a class="navcta" href="tel:${PHONE_TEL}">${PHONE}</a></div>
</nav>

<header class="hero">
  <div class="wrap">
    <span class="eyebrow">● ${esc(loc.countyName)} · ${esc(loc.region)}</span>
    <h1 class="serif">Navigating Permits &amp; Compliance in<br><i>${esc(loc.cityName)} and ${esc(loc.countyName)}.</i></h1>
    <p class="lead">${esc(loc.heroTitle)}. Palma Building Solutions is your single point of contact for permits, expired-permit closeouts, and code-violation resolution across ${esc(loc.cityName)} and ${esc(loc.countyName)} — pairing you with a vetted network of independently licensed Florida engineers and contractors from the first call to a closed, compliant permit.</p>
    <div class="btns"><a class="btn solid" href="#estimate">Get a free estimate</a><a class="btn ghost" href="tel:${PHONE_TEL}">Call ${PHONE}</a></div>

    <div class="lookup">
      <span class="lab">Free permit &amp; violation check</span>
      <b>See what's on record for your ${esc(loc.cityName)} property.</b>
      <p>Enter the address. Our free tool pulls ${esc(loc.countyName)} property and permit records and flags unpermitted work in seconds — then we map the exact path to clear it.</p>
      <div class="row">
        <input id="taddr" placeholder="${esc(toolPlaceholder)}" aria-label="${esc(loc.cityName)} property address or folio" />
        <button id="trun" type="button">Check this property</button>
      </div>
      <div class="fine">Live county-records search. No login. Or call <a href="tel:${PHONE_TEL}" style="color:#e8915f">${PHONE}</a> and we'll run it with you.</div>
    </div>
  </div>
</header>

<section class="block">
  <div class="wrap">
    <h2 class="sec serif">What we handle in <i>${esc(loc.cityName)}</i></h2>
    <ul class="handle"><li>Pull the ${esc(loc.countyName)} permit and code record for your property</li><li>Close open and expired permits left behind by prior owners or contractors</li><li>Map the corrections a code violation requires and coordinate the fix</li><li>Prepare and seal drawings through licensed engineering partners</li><li>Coordinate inspections and get the case formally closed</li></ul>
    <div class="note"><b>Local note — ${esc(loc.cityName)}.</b> ${esc(loc.localNote)}</div>
  </div>
</section>

<section class="block alt">
  <div class="wrap">
    <h2 class="sec serif">How it <i>works</i></h2>
    <div class="steps">
      <div class="step"><div class="n">01</div><h4>Tell us the address</h4><p>We pull the ${esc(loc.cityName)} permit and code record and confirm exactly what you're dealing with.</p></div>
      <div class="step"><div class="n">02</div><h4>We build the plan</h4><p>A clear scope and a fixed path through the ${esc(loc.buildingDeptName)}, handled by licensed Florida pros.</p></div>
      <div class="step"><div class="n">03</div><h4>Closed and compliant</h4><p>Inspections passed, comments cleared, and your property in full legal standing.</p></div>
    </div>
  </div>
</section>

<section class="block">
  <div class="wrap">
    <h2 class="sec serif">How we <i>help</i> ${esc(loc.cityName)}</h2>
    <div class="svcgrid">
      <a class="svccard" href="/permitting"><h4>Permitting</h4><p>New and expired permits navigated and coordinated with ${esc(loc.countyName)} on your behalf.</p><span class="go">Learn more →</span></a>
      <a class="svccard" href="/code-violations"><h4>Code violations</h4><p>Clear ${esc(loc.commonViolation)} and bring the case back into legal standing.</p><span class="go">Learn more →</span></a>
      <a class="svccard" href="/drawings-engineering"><h4>Drawings &amp; engineering</h4><p>Prepared and sealed by licensed Florida engineering partners, built to pass review.</p><span class="go">Learn more →</span></a>
      <a class="svccard" href="/inspections-signoff"><h4>Inspections &amp; sign-off</h4><p>Coordinated through licensed inspectors and private providers, stage by stage.</p><span class="go">Learn more →</span></a>
    </div>
  </div>
</section>

<section class="block alt">
  <div class="wrap">
    <h2 class="sec serif">What clients <i>say</i></h2>
    <div class="quote"><div class="q">"I'm very grateful for the inspection on my house. The process was easy to schedule, fast, with great results. You guys are the best."</div><div class="who">Ileana Kluge · Verified Google review ★★★★★</div></div>
    <div class="quote"><div class="q">"Great staff. They were able to resolve onsite pre-existing conditions and assisted us to successfully complete the project."</div><div class="who">Pablo A. Rios · Verified Google review ★★★★★</div></div>
  </div>
</section>

<section class="block">
  <div class="wrap">
    <h2 class="sec serif">${esc(loc.cityName)} permits &amp; compliance <i>FAQ</i></h2>
    <div class="faq">${faqHtml(loc)}</div>
  </div>
</section>

<section class="block alt" id="estimate">
  <div class="wrap">
    <span class="eyebrow">● FREE ESTIMATE</span>
    <h2 class="sec serif">Start your <i>${esc(loc.cityName)}</i> project</h2>
    <p class="lead">Tell us about it and we'll reach out fast. Prefer to talk? Call <a href="tel:${PHONE_TEL}" style="color:var(--gold)">${PHONE}</a>.</p>
    <form class="lf" id="leadform" novalidate>
      <div class="two"><input id="lf-name" placeholder="Full name*" autocomplete="name"><input id="lf-phone" type="tel" placeholder="Phone*" autocomplete="tel"></div>
      <div class="two"><input id="lf-email" type="email" placeholder="Email*" autocomplete="email"><input id="lf-addr" placeholder="Property address" autocomplete="street-address"></div>
      <textarea id="lf-msg" placeholder="Briefly describe your project (optional)"></textarea>
      <button class="submit" id="lf-submit" type="submit">Request my free estimate</button>
      <div class="status" id="lf-status" role="status"></div>
    </form>
  </div>
</section>

<section class="block">
  <div class="wrap">
    <h2 class="sec serif" style="font-size:22px">Other Florida service areas</h2>
    <p style="color:var(--muted);margin-top:6px;font-size:14px">${renderNearby(loc)}</p>
    <div class="links">${otherLinks(all, loc)}</div>
  </div>
</section>

<footer>
  <div class="wrap">
    Palma Building Solutions · Permitting and compliance across all 67 Florida counties · <a href="tel:${PHONE_TEL}">${PHONE}</a> · <a href="mailto:office@palma.llc">office@palma.llc</a><br>
    © Palma Building Solutions, a permitting and project-coordination company. Engineering and construction services are provided by a network of independently licensed Florida professionals. Palma Building Solutions is not an engineering or contracting firm.
  </div>
</footer>

<script>
(function(){
  // Localized free-tool handoff → permit-check-mvp with the typed address.
  var btn=document.getElementById("trun"),addr=document.getElementById("taddr");
  if(btn&&addr){
    var go=function(){var a=encodeURIComponent((addr.value||"").trim());if(window.track)track("tool_open",{page:"${loc.slug}",has_address:!!a});window.open("https://permit-check-mvp.vercel.app/"+(a?("?address="+a):""),"_blank");};
    btn.onclick=go;addr.addEventListener("keydown",function(e){if(e.key==="Enter")go();});
  }
  document.addEventListener("click",function(e){if(!e.target.closest)return;var t=e.target.closest('a[href^="tel:"]');if(t&&window.track)track("phone_click");});
  var lf=document.getElementById("leadform"); if(!lf)return;
  lf.addEventListener("submit",function(e){
    e.preventDefault();
    var v=function(id){return (document.getElementById(id).value||"").trim();};
    var name=v("lf-name"),phone=v("lf-phone"),email=v("lf-email"),ad=v("lf-addr"),msg=v("lf-msg");
    var st=document.getElementById("lf-status"),sb=document.getElementById("lf-submit");
    st.className="status";st.textContent="";
    if(!name||!phone||!/.+@.+\\..+/.test(email)){st.className="status err";st.textContent="Please enter your name, phone, and a valid email.";return;}
    var body={name:name,email:email,message:"[Website estimate request]\\nPage: ${loc.cityName} location\\nPhone: "+phone+"\\nAddress: "+(ad||"Not provided")+"\\n\\n"+(msg||"(no message)")};
    sb.disabled=true;sb.textContent="Sending…";
    fetch("/api/support",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
      .then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j};});})
      .then(function(res){if(res.ok){if(window.track)track("generate_lead",{page:"${loc.slug}"});lf.reset();st.className="status ok";st.textContent="Thanks! We received your request and will reach out shortly.";}else{st.className="status err";st.textContent=(res.j&&res.j.message)||"Something went wrong. Please call ${PHONE}.";}})
      .catch(function(){st.className="status err";st.textContent="Network error. Please call ${PHONE}.";})
      .finally(function(){sb.disabled=false;sb.textContent="Request my free estimate";});
  });
})();
</script>
</body>
</html>
`;
}

// ---- run ----
const locations = JSON.parse(readFileSync(DATA, 'utf8'));
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

let count = 0;
for (const loc of locations) {
  const html = page(loc, locations);
  // Guard: fail loudly if any placeholder token leaked into the output.
  const leak = html.match(/\{\{[^}]+\}\}/);
  if (leak) {
    console.error(`LEAK in ${loc.slug}: ${leak[0]}`);
    process.exit(1);
  }
  writeFileSync(resolve(OUT_DIR, `${loc.slug}.html`), html);
  count++;
}

// Hub index at /locations — keeps the metro pages linked (not orphaned) and
// backs the breadcrumb "Service areas" node.
function hubPage(all) {
  const cards = all
    .map(
      (l) =>
        `<a class="svccard" href="/locations/${l.slug}"><h4>${esc(l.cityName)}</h4><p>${esc(
          l.countyName,
        )} · ${esc(l.region)}. Permits, expired-permit closeouts, and code-violation resolution.</p><span class="go">View ${esc(
          l.cityName,
        )} →</span></a>`,
    )
    .join('');
  const hubLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://palma.llc/' },
      { '@type': 'ListItem', position: 2, name: 'Service areas', item: 'https://palma.llc/locations' },
    ],
  });
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Florida Service Areas | Palma Building Solutions</title>
<meta name="description" content="Palma Building Solutions handles permits, expired-permit closeouts, and code-violation resolution across Florida's major metros — Orlando, Tampa, Jacksonville, and more. Free estimate: ${PHONE}." />
<link rel="canonical" href="https://palma.llc/locations" />
<meta name="theme-color" content="#f6f2e9" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');window.track=function(n,p){try{gtag('event',n,p||{});}catch(e){}};</script>
<meta property="og:type" content="website" />
<meta property="og:url" content="https://palma.llc/locations" />
<meta property="og:title" content="Florida Service Areas | Palma Building Solutions" />
<meta property="og:image" content="${OG_IMAGE}" />
<script type="application/ld+json">${hubLd}</script>
<link rel="stylesheet" href="/svc.css" />
</head>
<body>
<nav>
  <a class="brand" href="/"><span class="mark">▲</span><b>PALMA</b><span>BUILDING SOLUTIONS</span></a>
  <div class="navlinks"><a href="/services">Services</a><a href="/#tool">Tools</a><a href="/how-it-works">How it works</a><a href="/#contact">Contact</a><a class="navcta" href="tel:${PHONE_TEL}">${PHONE}</a></div>
</nav>
<header class="hero">
  <div class="wrap">
    <span class="eyebrow">● FLORIDA SERVICE AREAS</span>
    <h1 class="serif">Permits &amp; compliance, <i>statewide.</i></h1>
    <p class="lead">Palma coordinates permitting, expired-permit closeouts, and code-violation resolution across all 67 Florida counties — with dedicated local guidance for these major metros.</p>
    <div class="btns"><a class="btn solid" href="/#tool">Check a property</a><a class="btn ghost" href="tel:${PHONE_TEL}">Call ${PHONE}</a></div>
  </div>
</header>
<section class="block">
  <div class="wrap">
    <h2 class="sec serif">Choose your <i>region</i></h2>
    <div class="svcgrid">${cards}</div>
  </div>
</section>
<footer>
  <div class="wrap">
    Palma Building Solutions · Permitting and compliance across all 67 Florida counties · <a href="tel:${PHONE_TEL}">${PHONE}</a> · <a href="mailto:office@palma.llc">office@palma.llc</a><br>
    © Palma Building Solutions, a permitting and project-coordination company. Engineering and construction services are provided by a network of independently licensed Florida professionals. Palma Building Solutions is not an engineering or contracting firm.
  </div>
</footer>
</body>
</html>
`;
}
writeFileSync(resolve(OUT_DIR, 'index.html'), hubPage(locations));

console.log(`Generated ${count} location pages + hub → locations/`);

if (process.argv.includes('--wizard')) {
  // Compact region list for the homepage Diagnostic Wizard picker (EN + ES).
  // Keep this the single source of truth: regenerate and paste into index.html
  // and es.html whenever data/locations.json changes.
  const arr = locations.map((l) => ({ c: l.cityName, k: l.countyName, s: l.slug }));
  console.log('\n--- WIZARD REGION ARRAY (paste as LOCATIONS) ---');
  console.log('var LOCATIONS=' + JSON.stringify(arr) + ';');
}

if (process.argv.includes('--links')) {
  console.log('\n--- FOOTER SNIPPET (Expanded Service Areas) ---');
  console.log(
    locations
      .map((l) => `<a href="/locations/${l.slug}">${l.cityName} (${l.countyName.replace(/ County$/, '')})</a>`)
      .join(''),
  );
  console.log('\n--- SITEMAP LINES ---');
  console.log(
    locations
      .map((l) => `  <url><loc>https://palma.llc/locations/${l.slug}</loc><priority>0.8</priority></url>`)
      .join('\n'),
  );
}
