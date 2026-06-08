/* ============================================================
   Palma Permit — South Florida permit requirements data
   Sources: municipal building departments (Broward, Palm Beach,
   Miami-Dade), FL Product Approval, ASCE 7 / FBC HVHZ rules.
   This dataset powers the client-side readiness analyzer.
   ============================================================ */

window.PP_DATA = (function () {
  // ---- Cities ----------------------------------------------------------
  // t = permit types tracked, i = requirement items, g = documented gotchas
  // hvhz derived from county (Broward + Miami-Dade = HVHZ).
  const cities = [
    // Broward (HVHZ)
    { slug: "fort-lauderdale", name: "Fort Lauderdale", county: "Broward", t: 23, i: 333, g: 36, phone: "954-828-5191", portal: "LauderBuild (Accela)" },
    { slug: "hollywood", name: "Hollywood", county: "Broward", t: 21, i: 284, g: 60, phone: "954-921-3335", portal: "Hollywood ePermits" },
    { slug: "pompano-beach", name: "Pompano Beach", county: "Broward", t: 25, i: 400, g: 29, phone: "954-786-4669", portal: "City Portal" },
    { slug: "coral-springs", name: "Coral Springs", county: "Broward", t: 22, i: 313, g: 45, phone: "954-344-1025", portal: "City Portal" },
    { slug: "plantation", name: "Plantation", county: "Broward", t: 24, i: 283, g: 49, phone: "954-797-2765", portal: "City Portal" },
    { slug: "davie", name: "Town of Davie", county: "Broward", t: 29, i: 415, g: 14, phone: "954-797-1111", portal: "City Portal" },
    { slug: "miramar", name: "Miramar", county: "Broward", t: 22, i: 300, g: 26, phone: "954-602-3275", portal: "City Portal" },
    { slug: "pembroke-pines", name: "Pembroke Pines", county: "Broward", t: 20, i: 337, g: 32, phone: "954-450-1050", portal: "City Portal" },
    { slug: "weston", name: "City of Weston", county: "Broward", t: 20, i: 255, g: 32, phone: "954-385-2600", portal: "City Portal" },
    { slug: "coconut-creek", name: "Coconut Creek", county: "Broward", t: 25, i: 215, g: 18, phone: "954-973-6750", portal: "City Portal" },
    { slug: "deerfield-beach", name: "Deerfield Beach", county: "Broward", t: 21, i: 300, g: 22, phone: "954-480-4250", portal: "City Portal" },
    { slug: "lauderdale-by-the-sea", name: "Lauderdale-by-the-Sea", county: "Broward", t: 20, i: 292, g: 32, phone: "954-640-4215", portal: "City Portal" },
    { slug: "lighthouse-point", name: "Lighthouse Point", county: "Broward", t: 20, i: 364, g: 39, phone: "954-943-6509", portal: "City Portal" },
    { slug: "margate", name: "Margate", county: "Broward", t: 22, i: 340, g: 41, phone: "954-970-3004", portal: "City Portal" },
    { slug: "oakland-park", name: "Oakland Park", county: "Broward", t: 19, i: 305, g: 30, phone: "954-630-4350", portal: "City Portal" },
    { slug: "sunrise", name: "Sunrise", county: "Broward", t: 17, i: 261, g: 24, phone: "954-572-2354", portal: "City Portal" },
    { slug: "tamarac", name: "Tamarac", county: "Broward", t: 21, i: 321, g: 14, phone: "954-597-3420", portal: "City Portal" },
    // Palm Beach (NOT HVHZ)
    { slug: "west-palm-beach", name: "West Palm Beach", county: "Palm Beach", t: 19, i: 283, g: 44, phone: "561-805-6700", portal: "City Portal" },
    { slug: "boca-raton", name: "Boca Raton", county: "Palm Beach", t: 22, i: 293, g: 35, phone: "561-393-7930", portal: "City Portal" },
    { slug: "delray-beach", name: "Delray Beach", county: "Palm Beach", t: 18, i: 200, g: 53, phone: "561-243-7200", portal: "City Portal" },
    { slug: "boynton-beach", name: "Boynton Beach", county: "Palm Beach", t: 18, i: 225, g: 55, phone: "561-742-6350", portal: "City Portal" },
    { slug: "wellington", name: "Wellington", county: "Palm Beach", t: 20, i: 328, g: 40, phone: "561-791-4000", portal: "City Portal" },
    { slug: "lake-worth-beach", name: "Lake Worth Beach", county: "Palm Beach", t: 16, i: 277, g: 25, phone: "561-586-1652", portal: "City Portal" },
    // Miami-Dade (HVHZ)
    { slug: "miami", name: "Miami", county: "Miami-Dade", t: 21, i: 230, g: 58, phone: "305-416-1100", portal: "iBuild" },
    { slug: "miami-beach", name: "Miami Beach", county: "Miami-Dade", t: 19, i: 250, g: 17, phone: "305-673-7610", portal: "CSS Portal" },
    { slug: "hialeah", name: "Hialeah", county: "Miami-Dade", t: 20, i: 212, g: 40, phone: "305-883-5825", portal: "City Portal" },
    { slug: "homestead", name: "Homestead", county: "Miami-Dade", t: 16, i: 294, g: 55, phone: "305-224-4500", portal: "City Portal" },
    { slug: "kendall", name: "Kendall (Unincorporated Miami-Dade)", county: "Miami-Dade", t: 20, i: 311, g: 41, phone: "786-315-2100", portal: "Miami-Dade Portal" },
    { slug: "north-miami", name: "North Miami", county: "Miami-Dade", t: 19, i: 365, g: 57, phone: "305-895-9825", portal: "City Portal" },
    { slug: "miami-gardens", name: "Miami Gardens", county: "Miami-Dade", t: 19, i: 201, g: 36, phone: "305-622-8027", portal: "City Portal" },
  ].map(c => ({ ...c, hvhz: c.county === "Broward" || c.county === "Miami-Dade" }));

  // ---- Document definitions -------------------------------------------
  // critical: rejection if missing. hvhzOnly: only required in HVHZ counties.
  const D = {
    application:   { id: "application",   label: "Building permit application (county uniform + city supplement)", critical: true,
      tip: "Use the current Broward/Miami-Dade uniform application plus the city supplement. Fill in BLACK INK; only signatures may be blue." },
    signatures:    { id: "signatures",    label: "Owner AND contractor signatures on application", critical: true,
      tip: "Most SF cities reject applications signed by only one party. Both the owner and the licensed contractor must sign." },
    license:       { id: "license",       label: "Contractor license registered with the city", critical: true,
      tip: "State license is not enough — the contractor must be registered/active with this specific municipality." },
    insurance:     { id: "insurance",     label: "Insurance certificate — exact city name & address as holder", critical: true,
      tip: "The certificate holder line must read the city's exact legal name and address. Abbreviations or a wrong address = rejection." },
    noc:           { id: "noc",           label: "Notice of Commencement (recorded) — jobs over threshold", critical: false,
      tip: "Required and recorded for jobs above the city's dollar threshold (commonly $5,000; some cities/trades differ). Post at job site before first inspection." },
    survey:        { id: "survey",        label: "Current signed/sealed boundary survey", critical: true,
      tip: "Most cities want a recent survey (often within a few years) with a zoning affidavit for site-related scopes." },
    sealedPlans:   { id: "sealedPlans",   label: "Signed & sealed plans (FL-licensed architect/engineer)", critical: true,
      tip: "Plans must be signed and sealed by a Florida-registered design professional for the scope of work." },
    sitePlan:      { id: "sitePlan",      label: "Site plan showing dimensions & setbacks", critical: true,
      tip: "Show the structure, dimensions, setbacks from property lines, and easements." },
    energyCalc:    { id: "energyCalc",    label: "Florida energy calculations (where applicable)", critical: false,
      tip: "Required for conditioned-space work and most HVAC/mechanical scopes." },
    productApproval:{ id: "productApproval", label: "Product approvals — FL Product Approval # or Miami-Dade NOA", critical: true, hvhzOnly: true,
      tip: "In HVHZ (Broward/Miami-Dade), exterior products must show an FL# or Miami-Dade NOA. Generic spec sheets are rejected." },
    structuralCalcs:{ id: "structuralCalcs", label: "Structural calculations (signed & sealed)", critical: false,
      tip: "Required where the scope affects structure — additions, enclosures, large openings, etc." },
    windLoad:      { id: "windLoad",      label: "Wind-load / attachment details (ASCE 7 / FBC)", critical: true,
      tip: "Show design wind speed and fastening schedule. HVHZ uses the highest design pressures in the state." },
    cutSheets:     { id: "cutSheets",     label: "Equipment cut sheets / manufacturer specs", critical: false,
      tip: "Provide manufacturer data for installed equipment (panels, AC units, water heaters, etc.)." },
    loadCalc:      { id: "loadCalc",      label: "Load calculation (electrical or Manual J)", critical: false,
      tip: "Electrical service work needs a load calc; HVAC needs a Manual J load calculation." },
    riser:         { id: "riser",         label: "Riser / one-line diagram", critical: false,
      tip: "Electrical and fire systems require a riser or one-line diagram." },
    elevation:     { id: "elevation",     label: "Elevations showing opening sizes/locations", critical: false,
      tip: "Window, door, and shutter permits need elevations identifying each opening." },
    poolBarrier:   { id: "poolBarrier",   label: "Pool safety barrier / drowning-prevention details", critical: true,
      tip: "Florida requires a code-compliant barrier (fence, alarms, or cover). Missing barrier details is a top pool-permit rejection." },
    bonding:       { id: "bonding",       label: "Equipotential bonding plan", critical: false,
      tip: "Pools and spas require an equipotential bonding grid per NEC 680." },
    treeProtection:{ id: "treeProtection", label: "Tree-protection / landscape affidavit (where applicable)", critical: false,
      tip: "Demolition and site work often require a tree-protection plan or affidavit." },
    marineSurvey:  { id: "marineSurvey",  label: "Hydrographic / marine survey & seawall checklist", critical: true,
      tip: "Dock and seawall permits need a marine survey and the city's seawall/dock checklist; agency sign-offs may apply." },
  };

  // ---- Permit types ----------------------------------------------------
  const base = ["application", "signatures", "license", "insurance", "noc"];
  const permitTypes = [
    { id: "roofing", label: "Roofing (Re-Roof / New Roof)", docs: [...base, "sealedPlans", "productApproval", "windLoad", "cutSheets"] },
    { id: "general", label: "Building / General (Addition / Alteration / New SFR)", docs: [...base, "sealedPlans", "survey", "sitePlan", "energyCalc", "productApproval", "structuralCalcs", "windLoad"] },
    { id: "hvac", label: "Mechanical / HVAC (A/C Replacement / New)", docs: [...base, "energyCalc", "loadCalc", "cutSheets", "productApproval"] },
    { id: "electrical", label: "Electrical (Service / Panel / General)", docs: [...base, "loadCalc", "riser", "cutSheets"] },
    { id: "plumbing", label: "Plumbing", docs: [...base, "riser", "cutSheets"] },
    { id: "windows", label: "Windows / Doors / Shutters", docs: [...base, "productApproval", "elevation", "windLoad"] },
    { id: "pool", label: "Pool & Spa", docs: [...base, "sealedPlans", "survey", "sitePlan", "poolBarrier", "bonding"] },
    { id: "fence", label: "Fence / Wall / Gate", docs: [...base, "survey", "sitePlan", "productApproval"] },
    { id: "solar", label: "Solar Panel Installation", docs: [...base, "sealedPlans", "productApproval", "windLoad", "loadCalc", "cutSheets"] },
    { id: "ev", label: "EV Charger Installation", docs: [...base, "loadCalc", "riser", "cutSheets"] },
    { id: "generator", label: "Generator", docs: [...base, "sealedPlans", "productApproval", "loadCalc", "cutSheets"] },
    { id: "demolition", label: "Demolition (Interior / Exterior)", docs: [...base, "survey", "sitePlan", "treeProtection"] },
    { id: "marine", label: "Dock / Seawall / Marine", docs: [...base, "sealedPlans", "marineSurvey", "productApproval", "windLoad"] },
    { id: "driveway", label: "Driveway / Paving", docs: [...base, "survey", "sitePlan"] },
    { id: "shed", label: "Shed / Accessory Structure", docs: [...base, "survey", "sitePlan", "productApproval", "windLoad"] },
    { id: "sign", label: "Sign", docs: [...base, "sealedPlans", "elevation", "windLoad"] },
    { id: "fire", label: "Fire Sprinkler / Alarm", docs: [...base, "sealedPlans", "riser", "cutSheets"] },
    { id: "enclosure", label: "Screen / Room Enclosure", docs: [...base, "sealedPlans", "survey", "productApproval", "structuralCalcs", "windLoad"] },
    { id: "co", label: "Certificate of Occupancy / Completion", docs: ["application", "signatures", "survey"] },
    { id: "waterheater", label: "Water Heater Replacement", docs: [...base, "cutSheets"] },
  ];

  // ---- City-specific gotchas (curated, real) --------------------------
  const gotchas = {
    "fort-lauderdale": [
      "100% digital via LauderBuild — paper applications are no longer accepted.",
      "Forms must be in BLACK INK; only signatures may be blue.",
      "Insurance holder must read EXACTLY: 'City of Fort Lauderdale, 700 NW 19th Avenue, Fort Lauderdale, FL 33311'.",
      "Upload each insurance document as a SEPARATE PDF to the correct category — do not combine.",
      "NOC required for jobs over $5,000; post at job site before first inspection.",
    ],
    "weston": [
      "A/C (HVAC) NOC threshold is $15,000 — NOT the standard $2,500. Filing an NOC you don't need wastes a day.",
      "Permits administered through the city's contracted building services — confirm the active portal before filing.",
    ],
    "davie": [
      "Walk-through review is ONE shot — if rejected you restart through regular review (can add ~3 weeks). Only walk through a bulletproof package.",
    ],
    "miami-beach": [
      "Historic-district and resiliency reviews add steps; confirm if the address is in a historic or flood overlay before filing.",
      "SHA-1 / digital-signature requirements apply to electronically sealed plans.",
    ],
    "hollywood": [
      "High volume of documented rejection reasons — double-check survey age and product-approval numbers before submitting.",
    ],
    "miami": [
      "Submitted through iBuild; zoning improvement and impact-fee reviews can run in parallel — incomplete zoning data stalls the whole package.",
    ],
  };

  const genericGotchas = [
    "In HVHZ (Broward & Miami-Dade), every exterior product needs an FL# or Miami-Dade NOA — generic spec sheets are rejected.",
    "Insurance certificate holder must match the city's exact legal name and address.",
    "Both owner and contractor must sign the application.",
    "Confirm the NOC dollar threshold for this city and trade before filing — it varies.",
    "Surveys are often required to be recent (commonly within ~5 years) and signed/sealed.",
  ];

  function cityBySlug(s) { return cities.find(c => c.slug === s); }
  function permitById(id) { return permitTypes.find(p => p.id === id); }
  function docById(id) { return D[id]; }
  function gotchasFor(slug) {
    const c = cityBySlug(slug);
    const specific = gotchas[slug] || [];
    return specific.length ? specific : genericGotchas.slice(0, c && c.hvhz ? 5 : 4);
  }

  return { cities, permitTypes, D, cityBySlug, permitById, docById, gotchasFor };
})();
