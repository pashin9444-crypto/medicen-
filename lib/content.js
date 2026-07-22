// Editable site content, stored in the database (KV). Defaults come from the code,
// so if the DB is empty or unreachable the site simply uses the original values.
//   - bottleCents / collectionCents : Stripe-charged product prices
//   - classPriceCents               : one price shared by all classes
//   - classWhen                     : the date/time line shown on each class

const kv = require("./kv.js");
const { PRODUCTS } = require("../products.js");
const CONTENT_KEY = "site:content";
const HISTORY_KEY = "site:content:history";

const CLASS_IDS = ["class-01", "class-02", "class-03", "class-04", "class-05"];

// Data-driven classes / retreats / events. Serena adds, edits, reorders, duplicates
// these from the admin; the classes page renders them (dynamic dates, no sample data).
function defaultEvents() {
  return [
    { id: "class-01", type: "class", title: "Understanding Medicinal Mushrooms", image: "assets/class-mushrooms.jpg", color: "var(--acc-daily)", date: "2026-08-05", time: "6:00 PM", duration: "2 hours", priceDollars: 40, waiver: true,
      desc: "Whether you're curious about brain health, immunity, stress, athletic performance, cancer support, or longevity, you'll leave understanding which mushrooms may be appropriate for different goals — and how to avoid wasting money on ineffective products." },
    { id: "class-02", type: "class", title: "Build Your Own Apothecary", image: "assets/class-apothecary.jpg", color: "var(--bronze-deep)", date: "2026-08-13", time: "6:00 PM", duration: "2 hours", priceDollars: 40, waiver: true,
      desc: "Walking into a supplement store can be overwhelming. Learn to thoughtfully build an evidence-informed home apothecary using herbs, medicinal mushrooms, vitamins, minerals, teas, tinctures, and simple natural remedies — a practical, budget-friendly toolkit filled with remedies you understand and trust." },
    { id: "class-03", type: "class", title: "Gut Health & the Microbiome", image: "assets/class-gut-health.jpg", color: "var(--acc-acute)", date: "2026-08-19", time: "6:00 PM", duration: "2 hours", priceDollars: 40, waiver: true,
      desc: "Learn how gut health influences immunity, inflammation, mood, hormones, and overall wellness. Covers the microbiome, digestion, probiotics, prebiotics, medicinal mushrooms for gut support, and nutrition strategies for a resilient digestive system." },
    { id: "class-04", type: "class", title: "Improving Focus & Memory Naturally", image: "assets/class-focus-memory.jpg", color: "var(--acc-brain)", date: "2026-08-27", time: "6:00 PM", duration: "2 hours", priceDollars: 40, waiver: true,
      desc: "A practical look at supporting attention, recall, and mental stamina through nootropic mushrooms, adaptogenic herbs, sleep, and lifestyle — and how to tell evidence-informed approaches from hype." },
    { id: "class-05", type: "class", title: "Waldorf for Adults: Creative Rhythm & Restorative Art Practice", image: "assets/class-waldorf.png", color: "var(--acc-night)", date: "2026-08-08", time: "10:00 AM", duration: "2 hours · biweekly", priceDollars: 40, waiver: true, note: "Give-back class: 25% of your class fee is donated to the Waldorf school.",
      desc: "A biweekly experiential class bringing the foundational arts of Waldorf education into an adult setting as gentle art therapy and nervous-system regulation within an integrative wellness framework. Join for one class or the 10-session series — each is unique while building on the last." },
  ];
}

function defaults() {
  return {
    bottleCents: PRODUCTS["daily-longevity"].priceInCents,
    collectionCents: PRODUCTS["complete-collection"].priceInCents,
    classPriceCents: 4000,
    classWhen: {
      "class-01": "Wed, Jul 8 · 6:00 PM",
      "class-02": "Thu, Jul 16 · 6:00 PM",
      "class-03": "Wed, Jul 22 · 6:00 PM",
      "class-04": "Thu, Jul 30 · 6:00 PM",
      "class-05": "Biweekly · Sat Jul 11 & Jul 25 · 10:00 AM",
    },
    texts: {},   // free-form text/color/font/size edits, keyed by page + element
    images: {},  // image/logo overrides, keyed by page + element (value = uploaded URL)
    icons: {},   // icon swaps, keyed by page + element (value = { orig, name })
    events: defaultEvents(), // classes + retreats list
    updatedAt: null,
    updatedBy: null,
  };
}

function merge(base, over) {
  const out = Object.assign({}, base, over || {});
  out.classWhen = Object.assign({}, base.classWhen, (over && over.classWhen) || {});
  out.texts = Object.assign({}, base.texts || {}, (over && over.texts) || {});
  out.images = Object.assign({}, base.images || {}, (over && over.images) || {});
  out.icons = Object.assign({}, base.icons || {}, (over && over.icons) || {});
  out.events = (over && Array.isArray(over.events)) ? over.events : (base.events || defaultEvents());
  return out;
}

function cleanEvents(arr) {
  if (!Array.isArray(arr)) return null;
  return arr.slice(0, 200).map(function (e) {
    e = e || {};
    const out = {
      id: String(e.id || ("ev-" + Math.random().toString(36).slice(2, 9))).slice(0, 60),
      type: e.type === "retreat" ? "retreat" : "class",
      title: String(e.title || "Untitled").slice(0, 200),
      desc: String(e.desc || "").slice(0, 4000),
      image: String(e.image || "").slice(0, 1000),
      color: /^(#[0-9a-fA-F]{3,8}|var\(--[a-z0-9-]+\)|[a-zA-Z]+)$/.test(String(e.color || "")) ? String(e.color) : "var(--bronze-deep)",
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(e.date || "")) ? String(e.date) : "",
      time: String(e.time || "").slice(0, 60),
      duration: String(e.duration || "").slice(0, 80),
      priceDollars: (isFinite(parseFloat(e.priceDollars)) && parseFloat(e.priceDollars) >= 0) ? parseFloat(e.priceDollars) : 0,
      waiver: e.waiver !== false,
    };
    if (e.note != null) out.note = String(e.note).slice(0, 400);
    if (e.location != null) out.location = String(e.location).slice(0, 200);
    if (e.eventbriteId != null) out.eventbriteId = String(e.eventbriteId).slice(0, 60);
    if (e.eventbriteUrl != null && /^https?:\/\//.test(String(e.eventbriteUrl))) out.eventbriteUrl = String(e.eventbriteUrl).slice(0, 500);
    if (e.ebImage != null) out.ebImage = String(e.ebImage).slice(0, 1000);
    return out;
  });
}

async function getContent() {
  try {
    if (kv.configured) {
      const c = await kv.kvGet(CONTENT_KEY);
      if (c && typeof c === "object") return merge(defaults(), c);
    }
  } catch (e) { /* fall back to defaults */ }
  return defaults();
}

function cleanCents(v, fallback) {
  const n = parseInt(v, 10);
  return (isFinite(n) && n >= 0 && n <= 100000000) ? n : fallback;
}

// Save a PARTIAL update, merged over whatever is currently stored.
// opts.skipHistory = don't add a version snapshot (used for internal write-backs
// like storing Eventbrite ids, so the change log stays clean).
async function saveContent(input, byEmail, opts) {
  input = input || {};
  opts = opts || {};
  const currentStored = await getContent();
  const d = defaults();

  const next = merge(currentStored, {});
  if (input.bottleCents !== undefined) next.bottleCents = cleanCents(input.bottleCents, currentStored.bottleCents);
  if (input.collectionCents !== undefined) next.collectionCents = cleanCents(input.collectionCents, currentStored.collectionCents);
  if (input.classPriceCents !== undefined) next.classPriceCents = cleanCents(input.classPriceCents, currentStored.classPriceCents);
  if (input.classWhen && typeof input.classWhen === "object") {
    CLASS_IDS.forEach(function (id) {
      if (input.classWhen[id] !== undefined) {
        next.classWhen[id] = String(input.classWhen[id]).slice(0, 120);
      }
    });
  }
  if (input.texts && typeof input.texts === "object") {
    next.texts = next.texts || {};
    Object.keys(input.texts).slice(0, 2000).forEach(function (k) {
      const t = input.texts[k];
      if (!t || typeof t !== "object") return;
      const clean = {};
      if (t.orig != null) clean.orig = String(t.orig).slice(0, 4000);
      if (t.text != null) clean.text = String(t.text)
        .replace(/<\/?(script|iframe|object|embed|link|meta)[^>]*>/gi, "")
        .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .replace(/javascript:/gi, "")
        .slice(0, 4000);
      if (t.color != null && /^(#[0-9a-fA-F]{3,8}|rgb|[a-zA-Z]+)/.test(String(t.color))) clean.color = String(t.color).slice(0, 40);
      if (t.font != null) clean.font = String(t.font).slice(0, 120);
      if (t.size != null && /^[0-9.]+(rem|em|px|%)$/.test(String(t.size))) clean.size = String(t.size);
      next.texts[String(k).slice(0, 200)] = Object.assign({}, next.texts[k], clean);
    });
  }
  if (input.icons && typeof input.icons === "object") {
    next.icons = next.icons || {};
    Object.keys(input.icons).slice(0, 500).forEach(function (k) {
      const ic = input.icons[k];
      if (!ic || typeof ic !== "object" || !ic.name) return;
      next.icons[String(k).slice(0, 200)] = {
        orig: ic.orig != null ? String(ic.orig).slice(0, 2000) : undefined,
        name: String(ic.name).slice(0, 60).replace(/[^a-z0-9-]/gi, ""),
      };
    });
  }
  if (input.events !== undefined) {
    const ev = cleanEvents(input.events);
    if (ev) next.events = ev;
  }
  if (input.images && typeof input.images === "object") {
    next.images = next.images || {};
    Object.keys(input.images).slice(0, 500).forEach(function (k) {
      const im = input.images[k];
      if (!im || typeof im !== "object" || !im.url) return;
      const url = String(im.url);
      if (!/^https?:\/\//.test(url) && url.indexOf("/") !== 0) return; // absolute or root-relative only
      next.images[String(k).slice(0, 200)] = { orig: im.orig != null ? String(im.orig).slice(0, 500) : undefined, url: url.slice(0, 1000) };
    });
  }
  next.updatedAt = Date.now();
  next.updatedBy = byEmail || null;

  // guard against a totally empty/garbage object
  next.bottleCents = cleanCents(next.bottleCents, d.bottleCents);
  next.collectionCents = cleanCents(next.collectionCents, d.collectionCents);
  next.classPriceCents = cleanCents(next.classPriceCents, d.classPriceCents);

  await kv.kvSet(CONTENT_KEY, next);
  if (!opts.skipHistory) await pushHistory(next);
  return next;
}

// ----- Change log / version history -----
async function pushHistory(snapshot) {
  try {
    await kv.kvListPush(HISTORY_KEY, snapshot);
    await kv.kvCommand(["LTRIM", HISTORY_KEY, "-50", "-1"]); // keep the last 50 versions
  } catch (e) { /* history is best-effort */ }
}

async function getHistory() {
  try { const arr = await kv.kvListAll(HISTORY_KEY); return (arr || []).slice().reverse(); } // newest first
  catch (e) { return []; }
}

async function revertTo(ts, byEmail) {
  const hist = await getHistory();
  let snap = null;
  for (let i = 0; i < hist.length; i++) { if (String(hist[i].updatedAt) === String(ts)) { snap = hist[i]; break; } }
  if (!snap) return null;
  const restored = merge(defaults(), snap);
  restored.updatedAt = Date.now();
  restored.updatedBy = (byEmail || "") + " (reverted)";
  await kv.kvSet(CONTENT_KEY, restored);
  await pushHistory(restored);
  return restored;
}

// Effective per-product price map (cents) for Stripe checkout.
function pricedProducts(content) {
  const priced = {};
  Object.keys(PRODUCTS).forEach(function (id) {
    const cents = id === "complete-collection" ? content.collectionCents : content.bottleCents;
    priced[id] = Object.assign({}, PRODUCTS[id], { priceInCents: cents });
  });
  return priced;
}

module.exports = { getContent, saveContent, defaults, pricedProducts, getHistory, revertTo, CONTENT_KEY, CLASS_IDS };
