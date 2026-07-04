#!/usr/bin/env node
// Programmatic hyper-local landing pages for Palma — English + Spanish.
//
// Reads data/locations.json and emits one static HTML page per metro per
// language:
//   locations/<slug>.html        → https://palma.llc/locations/<slug>
//   es/locations/<slug>.html     → https://palma.llc/es/locations/<slug>
// plus a hub index in each language. Static output = perfect Core Web Vitals.
// EN and ES pages are hreflang-linked and carry an EN/ES nav toggle.
//
// To add a market: add an object to data/locations.json (include localNoteEs)
// and re-run `node scripts/gen-locations.mjs`.
//
// Flags: --links (footer + sitemap snippets), --wizard (region array for the
// homepage picker).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA = resolve(ROOT, 'data/locations.json');

const GA_ID = 'G-D1NHS1GBDL';
const PHONE = '305-393-0690';
const PHONE_TEL = '+13053930690';
const OG_IMAGE = 'https://palma.llc/images/hero/stages/s9.jpg';
const EN_URL = (slug) => `https://palma.llc/locations/${slug}`;
const ES_URL = (slug) => `https://palma.llc/es/locations/${slug}`;

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const article = (w) => (/^[aeiou]/i.test(String(w).trim()) ? 'an' : 'a');
const countyShort = (c) => c.replace(/ County$/, '');

// Spanish display names for the region tag.
const REGION_ES = {
  'Central Florida': 'Centro de Florida',
  'Tampa Bay': 'Tampa Bay',
  'Northeast Florida': 'Noreste de Florida',
  'Southwest Florida': 'Suroeste de Florida',
  'Space Coast': 'Costa Espacial',
  'Gulf Coast': 'Costa del Golfo',
  'Central East Coast': 'Costa Este Central',
  'Treasure Coast': 'Costa del Tesoro',
  'Greater Orlando': 'Área de Orlando',
  'North Central Florida': 'Centro-Norte de Florida',
  'North Florida': 'Norte de Florida',
  'Northwest Florida': 'Noroeste de Florida',
};

// ---------------------------------------------------------------------------
// Language packs. Each returns the human-readable strings for one language;
// the template pulls everything from here so EN/ES stay structurally identical.
// ---------------------------------------------------------------------------
function pack(langCode) {
  const es = langCode === 'es';
  return {
    code: langCode,
    htmlLang: es ? 'es' : 'en',
    outDir: es ? 'es/locations' : 'locations',
    selfUrl: es ? ES_URL : EN_URL,
    homeUrl: es ? 'https://palma.llc/es' : 'https://palma.llc/',
    hubUrl: es ? 'https://palma.llc/es/locations' : 'https://palma.llc/locations',
    localNote: (l) => (es ? l.localNoteEs : l.localNote),
    // nav
    nav: es
      ? { brandHref: '/es', s: ['/es/services', 'Servicios'], t: ['/es#tool', 'Herramientas'], a: ['/es#about', 'Nosotros'], c: ['#estimate', 'Contacto'], toggle: (slug) => [`/locations/${slug}`, 'EN'] }
      : { brandHref: '/', s: ['/services', 'Services'], t: ['/#tool', 'Tools'], a: ['/how-it-works', 'How it works'], c: ['#estimate', 'Contact'], toggle: (slug) => [`/es/locations/${slug}`, 'ES'] },
    svcHref: es
      ? { permit: '/es/permitting', code: '/es/code-violations', dwg: '/es/drawings-engineering', insp: '/es/inspections-signoff' }
      : { permit: '/permitting', code: '/code-violations', dwg: '/drawings-engineering', insp: '/inspections-signoff' },
    // head
    title: (l) => (es
      ? `${l.cityName}: permisos de construcción y resolución de violaciones | Palma`
      : `${l.cityName} Building Permits & Code Violation Resolution | Palma`),
    metaDesc: (l) => (es
      ? `Cierra permisos vencidos y resuelve violaciones de código en ${l.cityName} y ${l.countyName}. Palma te conecta con socios locales de ingeniería y construcción con licencia. Presupuesto gratis: ${PHONE}.`
      : l.metaDescription),
    ogTitle: (l) => (es
      ? `Resuelve permisos de construcción y violaciones de código en ${l.cityName}`
      : l.heroTitle),
    // hero
    eyebrow: (l) => `● ${esc(l.countyName)} · ${esc(es ? (REGION_ES[l.region] || l.region) : l.region)}`,
    h1: (l) => (es
      ? `Permisos y cumplimiento en<br><i>${esc(l.cityName)} y ${esc(l.countyName)}.</i>`
      : `Navigating Permits &amp; Compliance in<br><i>${esc(l.cityName)} and ${esc(l.countyName)}.</i>`),
    heroLead: (l) => (es
      ? `Resuelve permisos de construcción y violaciones de código en ${esc(l.cityName)}. Palma Building Solutions es tu único punto de contacto para permisos, cierre de permisos vencidos y resolución de violaciones de código en ${esc(l.cityName)} y ${esc(l.countyName)} — te emparejamos con una red de ingenieros y contratistas con licencia independiente en Florida, desde la primera llamada hasta un permiso cerrado y en regla.`
      : `${esc(l.heroTitle)}. Palma Building Solutions is your single point of contact for permits, expired-permit closeouts, and code-violation resolution across ${esc(l.cityName)} and ${esc(l.countyName)} — pairing you with a vetted network of independently licensed Florida engineers and contractors from the first call to a closed, compliant permit.`),
    btnEstimate: es ? 'Presupuesto gratis' : 'Get a free estimate',
    btnCall: es ? `Llama al ${PHONE}` : `Call ${PHONE}`,
    // tool card
    toolLab: es ? 'Consulta gratis de permisos y violaciones' : 'Free permit & violation check',
    toolHead: (l) => (es ? `Mira qué hay registrado para tu propiedad en ${esc(l.cityName)}.` : `See what's on record for your ${esc(l.cityName)} property.`),
    toolPara: (l) => (es
      ? `Ingresa la dirección. Nuestra herramienta gratuita extrae los registros de propiedad y permisos de ${esc(l.countyName)} y detecta trabajo sin permiso en segundos — y luego trazamos el camino exacto para resolverlo.`
      : `Enter the address. Our free tool pulls ${esc(l.countyName)} property and permit records and flags unpermitted work in seconds — then we map the exact path to clear it.`),
    toolPlaceholder: (l) => (es ? `Ingresa una dirección o folio en ${l.cityName}` : `Enter ${article(l.cityName)} ${l.cityName} property address or folio…`),
    toolBtn: es ? 'Consultar propiedad' : 'Check this property',
    toolFine: es ? `Búsqueda en vivo de registros del condado. Sin registro. O llama al <a href="tel:${PHONE_TEL}" style="color:#e8915f">${PHONE}</a> y la hacemos contigo.` : `Live county-records search. No login. Or call <a href="tel:${PHONE_TEL}" style="color:#e8915f">${PHONE}</a> and we'll run it with you.`,
    // sections
    handleTitle: (l) => (es ? `Qué gestionamos en <i>${esc(l.cityName)}</i>` : `What we handle in <i>${esc(l.cityName)}</i>`),
    handleItems: (l) => (es
      ? [`Extraer el registro de permisos y código de ${esc(l.countyName)} de tu propiedad`, `Cerrar permisos abiertos y vencidos que dejaron dueños o contratistas anteriores`, `Trazar las correcciones que requiere una violación de código y coordinar el arreglo`, `Preparar y sellar planos con socios de ingeniería con licencia`, `Coordinar inspecciones y cerrar formalmente el caso`]
      : [`Pull the ${esc(l.countyName)} permit and code record for your property`, `Close open and expired permits left behind by prior owners or contractors`, `Map the corrections a code violation requires and coordinate the fix`, `Prepare and seal drawings through licensed engineering partners`, `Coordinate inspections and get the case formally closed`]),
    noteLabel: (l) => (es ? `Nota local — ${esc(l.cityName)}.` : `Local note — ${esc(l.cityName)}.`),
    howTitle: es ? `Cómo <i>funciona</i>` : `How it <i>works</i>`,
    steps: (l) => (es
      ? [['01', 'Dinos la dirección', `Extraemos el registro de permisos y código de ${esc(l.cityName)} y confirmamos exactamente a qué te enfrentas.`], ['02', 'Armamos el plan', `Un alcance claro y un camino fijo a través de ${esc(l.buildingDeptName)}, gestionado por profesionales con licencia en Florida.`], ['03', 'Cerrado y en regla', `Inspecciones aprobadas, comentarios resueltos y tu propiedad en plena regularidad legal.`]]
      : [['01', 'Tell us the address', `We pull the ${esc(l.cityName)} permit and code record and confirm exactly what you're dealing with.`], ['02', 'We build the plan', `A clear scope and a fixed path through the ${esc(l.buildingDeptName)}, handled by licensed Florida pros.`], ['03', 'Closed and compliant', `Inspections passed, comments cleared, and your property in full legal standing.`]]),
    helpTitle: (l) => (es ? `Cómo <i>ayudamos</i> a ${esc(l.cityName)}` : `How we <i>help</i> ${esc(l.cityName)}`),
    svc: (l) => (es
      ? [['Permisos', `Permisos nuevos y vencidos gestionados y coordinados con ${esc(l.countyName)} en tu nombre.`], ['Violaciones de código', `Resolvemos trabajos sin permiso y permisos vencidos y regularizamos el caso.`], ['Planos e ingeniería', `Preparados y sellados por socios de ingeniería con licencia en Florida, hechos para pasar la revisión.`], ['Inspecciones y cierre', `Coordinadas con inspectores con licencia y proveedores privados, etapa por etapa.`]]
      : [['Permitting', `New and expired permits navigated and coordinated with ${esc(l.countyName)} on your behalf.`], ['Code violations', `Clear ${esc(l.commonViolation)} and bring the case back into legal standing.`], ['Drawings & engineering', `Prepared and sealed by licensed Florida engineering partners, built to pass review.`], ['Inspections & sign-off', `Coordinated through licensed inspectors and private providers, stage by stage.`]]),
    svcMore: es ? 'Más información →' : 'Learn more →',
    saysTitle: es ? `Lo que dicen los <i>clientes</i>` : `What clients <i>say</i>`,
    reviewLabel: es ? 'Reseña verificada de Google' : 'Verified Google review',
    faqTitle: (l) => (es ? `Preguntas frecuentes de permisos y cumplimiento en <i>${esc(l.cityName)}</i>` : `${esc(l.cityName)} permits &amp; compliance <i>FAQ</i>`),
    estimateEyebrow: es ? '● PRESUPUESTO GRATIS' : '● FREE ESTIMATE',
    estimateTitle: (l) => (es ? `Empieza tu proyecto en <i>${esc(l.cityName)}</i>` : `Start your <i>${esc(l.cityName)}</i> project`),
    estimateLead: es ? `Cuéntanos y te contactamos rápido. ¿Prefieres hablar? Llama al <a href="tel:${PHONE_TEL}" style="color:var(--gold)">${PHONE}</a>.` : `Tell us about it and we'll reach out fast. Prefer to talk? Call <a href="tel:${PHONE_TEL}" style="color:var(--gold)">${PHONE}</a>.`,
    form: es
      ? { name: 'Nombre completo*', phone: 'Teléfono*', email: 'Email*', addr: 'Dirección de la propiedad', msg: 'Describe brevemente tu proyecto (opcional)', submit: 'Solicitar mi presupuesto gratis', sending: 'Enviando…', invalid: 'Ingresa tu nombre, teléfono y un correo válido.', ok: '¡Gracias! Recibimos tu solicitud y te contactaremos pronto.', gerr: `Algo salió mal. Llama al ${PHONE}.`, nerr: `Error de red. Llama al ${PHONE}.`, tag: 'Solicitud de presupuesto' }
      : { name: 'Full name*', phone: 'Phone*', email: 'Email*', addr: 'Property address', msg: 'Briefly describe your project (optional)', submit: 'Request my free estimate', sending: 'Sending…', invalid: 'Please enter your name, phone, and a valid email.', ok: 'Thanks! We received your request and will reach out shortly.', gerr: `Something went wrong. Please call ${PHONE}.`, nerr: `Network error. Please call ${PHONE}.`, tag: 'Website estimate request' },
    otherTitle: es ? `Otras <i>áreas de servicio</i> en Florida` : `Other Florida <i>service areas</i>`,
    nearbyText: (l) => {
      if (!Array.isArray(l.nearby) || !l.nearby.length) return '';
      const list = l.nearby.map(esc).join(', ');
      return es ? `Palma también atiende ${list} y el resto de ${esc(l.countyName)}.` : `Palma also serves ${list}, and the rest of ${esc(l.countyName)}.`;
    },
    otherLinkText: (l) => (es ? `Permisos y cumplimiento en ${esc(l.cityName)} (${esc(countyShort(l.countyName))})` : `Permits &amp; compliance in ${esc(l.cityName)} (${esc(countyShort(l.countyName))})`),
    footer: es
      ? `Palma Building Solutions · Permisos y cumplimiento en los 67 condados de Florida · <a href="tel:${PHONE_TEL}">${PHONE}</a> · <a href="mailto:office@palma.llc">office@palma.llc</a><br>\n    © Palma Building Solutions, una empresa de permisos y coordinación de proyectos. Los servicios de ingeniería y construcción los provee una red de profesionales con licencia independiente en Florida. Palma Building Solutions no es una firma de ingeniería ni de construcción.`
      : `Palma Building Solutions · Permitting and compliance across all 67 Florida counties · <a href="tel:${PHONE_TEL}">${PHONE}</a> · <a href="mailto:office@palma.llc">office@palma.llc</a><br>\n    © Palma Building Solutions, a permitting and project-coordination company. Engineering and construction services are provided by a network of independently licensed Florida professionals. Palma Building Solutions is not an engineering or contracting firm.`,
    // JSON-LD
    ldDesc: (l) => (es ? `Concierge de permisos y cumplimiento de Florida en ${l.cityName} y ${l.countyName}.` : `Florida's permitting and compliance concierge in ${l.cityName} and ${l.countyName}.`),
    breadcrumbHome: es ? ['Inicio', 'https://palma.llc/es'] : ['Home', 'https://palma.llc/'],
    breadcrumbAreas: es ? ['Áreas de servicio', 'https://palma.llc/es/locations'] : ['Service areas', 'https://palma.llc/locations'],
    faqItems: (l) => (es
      ? [
          { q: `¿Palma gestiona permisos y violaciones de código en ${l.cityName}?`, a: `Sí. Palma coordina el trabajo de permisos y cumplimiento en ${l.cityName} y ${l.countyName}, y te conecta con ingenieros y contratistas con licencia independiente en Florida que realizan el trabajo.` },
          { q: `¿Qué departamento de construcción atiende ${l.cityName}?`, a: `La mayoría del trabajo en ${l.countyName} se tramita a través de ${l.buildingDeptName}, aunque las ciudades incorporadas suelen emitir permisos en sus propios portales. Confirmamos qué autoridad tiene tu registro antes de hacer cualquier otra cosa.` },
          { q: `¿Palma es un contratista o ingeniero?`, a: `No. Palma Building Solutions es una empresa de permisos y coordinación de proyectos. La ingeniería y la construcción las realiza una red de profesionales con licencia independiente en Florida.` },
        ]
      : [
          { q: `Does Palma handle permits and code violations in ${l.cityName}?`, a: `Yes. Palma coordinates permitting and compliance work throughout ${l.cityName} and ${l.countyName}, and connects you with independently licensed Florida engineers and contractors who perform the work.` },
          { q: `Which building department handles ${l.cityName}?`, a: `Most ${l.countyName} work runs through the ${l.buildingDeptName}, though incorporated cities often permit on their own portals. We confirm which authority holds your record before doing anything else.` },
          { q: `Is Palma a contractor or engineer?`, a: `No. Palma Building Solutions is a permitting and project-coordination company. The engineering and construction are performed by a vetted network of independently licensed Florida professionals.` },
        ]),
    hubTitle: es ? 'Áreas de servicio en Florida | Palma Building Solutions' : 'Florida Service Areas | Palma Building Solutions',
    hubDesc: es ? `Palma Building Solutions gestiona permisos, cierre de permisos vencidos y resolución de violaciones de código en las principales metrópolis de Florida — Orlando, Tampa, Jacksonville y más. Presupuesto gratis: ${PHONE}.` : `Palma Building Solutions handles permits, expired-permit closeouts, and code-violation resolution across Florida's major metros — Orlando, Tampa, Jacksonville, and more. Free estimate: ${PHONE}.`,
    hubEyebrow: es ? '● ÁREAS DE SERVICIO EN FLORIDA' : '● FLORIDA SERVICE AREAS',
    hubH1: es ? `Permisos y cumplimiento, <i>en todo el estado.</i>` : `Permits &amp; compliance, <i>statewide.</i>`,
    hubLead: es ? `Palma coordina permisos, cierre de permisos vencidos y resolución de violaciones de código en los 67 condados de Florida — con orientación local dedicada para estas principales metrópolis.` : `Palma coordinates permitting, expired-permit closeouts, and code-violation resolution across all 67 Florida counties — with dedicated local guidance for these major metros.`,
    hubBtn: es ? 'Consultar una propiedad' : 'Check a property',
    hubChoose: es ? `Elige tu <i>región</i>` : `Choose your <i>region</i>`,
    hubCard: (l) => (es ? `${esc(l.countyName)} · ${esc(REGION_ES[l.region] || l.region)}. Permisos, cierre de permisos vencidos y resolución de violaciones de código.` : `${esc(l.countyName)} · ${esc(l.region)}. Permits, expired-permit closeouts, and code-violation resolution.`),
    hubView: (l) => (es ? `Ver ${esc(l.cityName)} →` : `View ${esc(l.cityName)} →`),
  };
}

function hreflang(slug) {
  return `<link rel="alternate" hreflang="en" href="${EN_URL(slug)}" />
<link rel="alternate" hreflang="es" href="${ES_URL(slug)}" />
<link rel="alternate" hreflang="x-default" href="${EN_URL(slug)}" />`;
}

function jsonLd(loc, L) {
  const url = L.selfUrl(loc.slug);
  const lb = {
    '@context': 'https://schema.org', '@type': 'LocalBusiness',
    name: `Palma Building Solutions - ${loc.cityName} Region`,
    description: L.ldDesc(loc), telephone: PHONE, url, image: OG_IMAGE,
    address: { '@type': 'PostalAddress', addressRegion: 'FL', addressLocality: loc.cityName },
    areaServed: [{ '@type': 'AdministrativeArea', name: loc.countyName }, { '@type': 'AdministrativeArea', name: loc.cityName }],
  };
  const faq = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: L.faqItems(loc).map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
  const bc = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: L.breadcrumbHome[0], item: L.breadcrumbHome[1] },
    { '@type': 'ListItem', position: 2, name: L.breadcrumbAreas[0], item: L.breadcrumbAreas[1] },
    { '@type': 'ListItem', position: 3, name: `${loc.cityName}, FL` },
  ] };
  return JSON.stringify([lb, faq, bc]);
}

function otherLinks(all, current, L, max = 9) {
  const others = all.filter((l) => l.slug !== current.slug);
  const same = others.filter((l) => l.region === current.region);
  const rest = others.filter((l) => l.region !== current.region);
  return [...same, ...rest].slice(0, max)
    .map((l) => `<a href="${L.code === 'es' ? '/es' : ''}/locations/${l.slug}">${L.otherLinkText(l)}</a>`).join('');
}

function page(loc, all, L) {
  const [ts, tl] = L.nav.toggle(loc.slug);
  const faqHtml = L.faqItems(loc).map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('');
  const handleHtml = L.handleItems(loc).map((i) => `<li>${i}</li>`).join('');
  const stepsHtml = L.steps(loc).map(([n, h, p]) => `<div class="step"><div class="n">${n}</div><h4>${esc(h)}</h4><p>${p}</p></div>`).join('');
  const svcHrefs = [L.svcHref.permit, L.svcHref.code, L.svcHref.dwg, L.svcHref.insp];
  const svcHtml = L.svc(loc).map(([h, p], i) => `<a class="svccard" href="${svcHrefs[i]}"><h4>${esc(h)}</h4><p>${p}</p><span class="go">${L.svcMore}</span></a>`).join('');

  return `<!DOCTYPE html>
<html lang="${L.htmlLang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(L.title(loc))}</title>
<meta name="description" content="${esc(L.metaDesc(loc))}" />
<link rel="canonical" href="${L.selfUrl(loc.slug)}" />
${hreflang(loc.slug)}
<meta name="theme-color" content="#f6f2e9" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');window.track=function(n,p){try{gtag('event',n,p||{});}catch(e){}};</script>
<meta property="og:type" content="website" />
<meta property="og:url" content="${L.selfUrl(loc.slug)}" />
<meta property="og:title" content="${esc(L.ogTitle(loc))}" />
<meta property="og:description" content="${esc(L.metaDesc(loc))}" />
<meta property="og:image" content="${OG_IMAGE}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(L.ogTitle(loc))}" />
<meta name="twitter:image" content="${OG_IMAGE}" />
<script type="application/ld+json">${jsonLd(loc, L)}</script>
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
  <a class="brand" href="${L.nav.brandHref}"><span class="mark">▲</span><b>PALMA</b><span>BUILDING SOLUTIONS</span></a>
  <div class="navlinks"><a href="${L.nav.s[0]}">${L.nav.s[1]}</a><a href="${L.nav.t[0]}">${L.nav.t[1]}</a><a href="${L.nav.a[0]}">${L.nav.a[1]}</a><a href="${L.nav.c[0]}">${L.nav.c[1]}</a><a href="${ts}" title="${L.code === 'es' ? 'English' : 'Español'}">${tl}</a><a class="navcta" href="tel:${PHONE_TEL}">${PHONE}</a></div>
</nav>

<header class="hero">
  <div class="wrap">
    <span class="eyebrow">${L.eyebrow(loc)}</span>
    <h1 class="serif">${L.h1(loc)}</h1>
    <p class="lead">${L.heroLead(loc)}</p>
    <div class="btns"><a class="btn solid" href="#estimate">${L.btnEstimate}</a><a class="btn ghost" href="tel:${PHONE_TEL}">${L.btnCall}</a></div>

    <div class="lookup">
      <span class="lab">${esc(L.toolLab)}</span>
      <b>${L.toolHead(loc)}</b>
      <p>${L.toolPara(loc)}</p>
      <div class="row">
        <input id="taddr" placeholder="${esc(L.toolPlaceholder(loc))}" aria-label="${esc(loc.cityName)}" />
        <button id="trun" type="button">${L.toolBtn}</button>
      </div>
      <div class="fine">${L.toolFine}</div>
    </div>
  </div>
</header>

<section class="block">
  <div class="wrap">
    <h2 class="sec serif">${L.handleTitle(loc)}</h2>
    <ul class="handle">${handleHtml}</ul>
    <div class="note"><b>${L.noteLabel(loc)}</b> ${esc(L.localNote(loc))}</div>
  </div>
</section>

<section class="block alt">
  <div class="wrap">
    <h2 class="sec serif">${L.howTitle}</h2>
    <div class="steps">${stepsHtml}</div>
  </div>
</section>

<section class="block">
  <div class="wrap">
    <h2 class="sec serif">${L.helpTitle(loc)}</h2>
    <div class="svcgrid">${svcHtml}</div>
  </div>
</section>

<section class="block alt">
  <div class="wrap">
    <h2 class="sec serif">${L.saysTitle}</h2>
    <div class="quote"><div class="q">"I'm very grateful for the inspection on my house. The process was easy to schedule, fast, with great results. You guys are the best."</div><div class="who">Ileana Kluge · ${L.reviewLabel} ★★★★★</div></div>
    <div class="quote"><div class="q">"Great staff. They were able to resolve onsite pre-existing conditions and assisted us to successfully complete the project."</div><div class="who">Pablo A. Rios · ${L.reviewLabel} ★★★★★</div></div>
  </div>
</section>

<section class="block">
  <div class="wrap">
    <h2 class="sec serif">${L.faqTitle(loc)}</h2>
    <div class="faq">${faqHtml}</div>
  </div>
</section>

<section class="block alt" id="estimate">
  <div class="wrap">
    <span class="eyebrow">${L.estimateEyebrow}</span>
    <h2 class="sec serif">${L.estimateTitle(loc)}</h2>
    <p class="lead">${L.estimateLead}</p>
    <form class="lf" id="leadform" novalidate>
      <div class="two"><input id="lf-name" placeholder="${esc(L.form.name)}" autocomplete="name"><input id="lf-phone" type="tel" placeholder="${esc(L.form.phone)}" autocomplete="tel"></div>
      <div class="two"><input id="lf-email" type="email" placeholder="${esc(L.form.email)}" autocomplete="email"><input id="lf-addr" placeholder="${esc(L.form.addr)}" autocomplete="street-address"></div>
      <textarea id="lf-msg" placeholder="${esc(L.form.msg)}"></textarea>
      <button class="submit" id="lf-submit" type="submit">${esc(L.form.submit)}</button>
      <div class="status" id="lf-status" role="status"></div>
    </form>
  </div>
</section>

<section class="block">
  <div class="wrap">
    <h2 class="sec serif" style="font-size:22px">${L.otherTitle}</h2>
    <p style="color:var(--muted);margin-top:6px;font-size:14px">${L.nearbyText(loc)}</p>
    <div class="links">${otherLinks(all, loc, L)}</div>
  </div>
</section>

<footer>
  <div class="wrap">
    ${L.footer}
  </div>
</footer>

<script>
(function(){
  var btn=document.getElementById("trun"),addr=document.getElementById("taddr");
  if(btn&&addr){
    var go=function(){var a=encodeURIComponent((addr.value||"").trim());if(window.track)track("tool_open",{page:"${loc.slug}",lang:"${L.code}",has_address:!!a});window.open("https://permit-check-mvp.vercel.app/"+(a?("?address="+a):""),"_blank");};
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
    if(!name||!phone||!/.+@.+\\..+/.test(email)){st.className="status err";st.textContent=${JSON.stringify(L.form.invalid)};return;}
    var body={name:name,email:email,message:"[${L.form.tag}]\\nPage: ${loc.cityName} (${L.code})\\nPhone: "+phone+"\\nAddress: "+(ad||"-")+"\\n\\n"+(msg||"-")};
    sb.disabled=true;sb.textContent=${JSON.stringify(L.form.sending)};
    fetch("/api/support",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
      .then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j};});})
      .then(function(res){if(res.ok){if(window.track)track("generate_lead",{page:"${loc.slug}",lang:"${L.code}"});lf.reset();st.className="status ok";st.textContent=${JSON.stringify(L.form.ok)};}else{st.className="status err";st.textContent=(res.j&&res.j.message)||${JSON.stringify(L.form.gerr)};}})
      .catch(function(){st.className="status err";st.textContent=${JSON.stringify(L.form.nerr)};})
      .finally(function(){sb.disabled=false;sb.textContent=${JSON.stringify(L.form.submit)};});
  });
})();
</script>
</body>
</html>
`;
}

function hubPage(all, L) {
  const cards = all.map((l) => `<a class="svccard" href="${L.code === 'es' ? '/es' : ''}/locations/${l.slug}"><h4>${esc(l.cityName)}</h4><p>${L.hubCard(l)}</p><span class="go">${L.hubView(l)}</span></a>`).join('');
  const bc = JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: L.breadcrumbHome[0], item: L.breadcrumbHome[1] },
    { '@type': 'ListItem', position: 2, name: L.breadcrumbAreas[0], item: L.breadcrumbAreas[1] },
  ] });
  const toolsHref = L.code === 'es' ? '/es#tool' : '/#tool';
  const altHub = L.code === 'es' ? 'https://palma.llc/locations' : 'https://palma.llc/es/locations';
  const altLang = L.code === 'es' ? 'en' : 'es';
  return `<!DOCTYPE html>
<html lang="${L.htmlLang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(L.hubTitle)}</title>
<meta name="description" content="${esc(L.hubDesc)}" />
<link rel="canonical" href="${L.hubUrl}" />
<link rel="alternate" hreflang="${L.htmlLang}" href="${L.hubUrl}" />
<link rel="alternate" hreflang="${altLang}" href="${altHub}" />
<link rel="alternate" hreflang="x-default" href="https://palma.llc/locations" />
<meta name="theme-color" content="#f6f2e9" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');window.track=function(n,p){try{gtag('event',n,p||{});}catch(e){}};</script>
<meta property="og:type" content="website" />
<meta property="og:url" content="${L.hubUrl}" />
<meta property="og:title" content="${esc(L.hubTitle)}" />
<meta property="og:image" content="${OG_IMAGE}" />
<script type="application/ld+json">${bc}</script>
<link rel="stylesheet" href="/svc.css" />
</head>
<body>
<nav>
  <a class="brand" href="${L.nav.brandHref}"><span class="mark">▲</span><b>PALMA</b><span>BUILDING SOLUTIONS</span></a>
  <div class="navlinks"><a href="${L.nav.s[0]}">${L.nav.s[1]}</a><a href="${toolsHref}">${L.nav.t[1]}</a><a href="${L.nav.c[0]}">${L.nav.c[1]}</a><a class="navcta" href="tel:${PHONE_TEL}">${PHONE}</a></div>
</nav>
<header class="hero">
  <div class="wrap">
    <span class="eyebrow">${L.hubEyebrow}</span>
    <h1 class="serif">${L.hubH1}</h1>
    <p class="lead">${L.hubLead}</p>
    <div class="btns"><a class="btn solid" href="${toolsHref}">${L.hubBtn}</a><a class="btn ghost" href="tel:${PHONE_TEL}">${L.btnCall}</a></div>
  </div>
</header>
<section class="block">
  <div class="wrap">
    <h2 class="sec serif">${L.hubChoose}</h2>
    <div class="svcgrid">${cards}</div>
  </div>
</section>
<footer>
  <div class="wrap">
    ${L.footer}
  </div>
</footer>
</body>
</html>
`;
}

// ---- run ----
const locations = JSON.parse(readFileSync(DATA, 'utf8'));
let total = 0;
for (const code of ['en', 'es']) {
  const L = pack(code);
  const outDir = resolve(ROOT, L.outDir);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  for (const loc of locations) {
    const html = page(loc, locations, L);
    const leak = html.match(/\{\{[^}]+\}\}/);
    if (leak) { console.error(`LEAK ${code}/${loc.slug}: ${leak[0]}`); process.exit(1); }
    writeFileSync(resolve(outDir, `${loc.slug}.html`), html);
    total++;
  }
  writeFileSync(resolve(outDir, 'index.html'), hubPage(locations, L));
}
console.log(`Generated ${total} location pages (EN+ES) + 2 hubs.`);

if (process.argv.includes('--wizard')) {
  const arr = locations.map((l) => ({ c: l.cityName, k: l.countyName, s: l.slug }));
  console.log('\n--- WIZARD REGION ARRAY (paste as LOCATIONS) ---');
  console.log('var LOCATIONS=' + JSON.stringify(arr) + ';');
}

if (process.argv.includes('--links')) {
  console.log('\n--- SITEMAP LINES (EN + ES) ---');
  const lines = [];
  lines.push('  <url><loc>https://palma.llc/locations</loc><priority>0.8</priority></url>');
  lines.push('  <url><loc>https://palma.llc/es/locations</loc><priority>0.7</priority></url>');
  for (const l of locations) lines.push(`  <url><loc>https://palma.llc/locations/${l.slug}</loc><priority>0.8</priority></url>`);
  for (const l of locations) lines.push(`  <url><loc>https://palma.llc/es/locations/${l.slug}</loc><priority>0.7</priority></url>`);
  console.log(lines.join('\n'));
}
