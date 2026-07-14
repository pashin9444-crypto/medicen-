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
    updatedAt: null,
    updatedBy: null,
  };
}

function merge(base, over) {
  const out = Object.assign({}, base, over || {});
  out.classWhen = Object.assign({}, base.classWhen, (over && over.classWhen) || {});
  return out;
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
async function saveContent(input, byEmail) {
  input = input || {};
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
  next.updatedAt = Date.now();
  next.updatedBy = byEmail || null;

  // guard against a totally empty/garbage object
  next.bottleCents = cleanCents(next.bottleCents, d.bottleCents);
  next.collectionCents = cleanCents(next.collectionCents, d.collectionCents);
  next.classPriceCents = cleanCents(next.classPriceCents, d.classPriceCents);

  await kv.kvSet(CONTENT_KEY, next);
  await pushHistory(next);
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
