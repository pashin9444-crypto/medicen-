// Editable site content, stored in the database (KV). For now: the two
// Stripe-charged product prices (single bottle, and the 5-bottle collection),
// in CENTS. Defaults come from products.js, so if the DB is empty or unreachable
// the site simply uses the original prices.

const kv = require("./kv.js");
const { PRODUCTS } = require("../products.js");
const CONTENT_KEY = "site:content";

function defaults() {
  return {
    bottleCents: PRODUCTS["daily-longevity"].priceInCents,        // all 5 extracts share one price
    collectionCents: PRODUCTS["complete-collection"].priceInCents,
    updatedAt: null,
    updatedBy: null,
  };
}

async function getContent() {
  try {
    if (kv.configured) {
      const c = await kv.kvGet(CONTENT_KEY);
      if (c && typeof c === "object") return Object.assign(defaults(), c);
    }
  } catch (e) { /* fall back to defaults */ }
  return defaults();
}

async function saveContent(input, byEmail) {
  input = input || {};
  const d = defaults();
  const bottle = parseInt(input.bottleCents, 10);
  const coll = parseInt(input.collectionCents, 10);
  const merged = {
    bottleCents: (isFinite(bottle) && bottle >= 0 && bottle <= 100000000) ? bottle : d.bottleCents,
    collectionCents: (isFinite(coll) && coll >= 0 && coll <= 100000000) ? coll : d.collectionCents,
    updatedAt: Date.now(),
    updatedBy: byEmail || null,
  };
  await kv.kvSet(CONTENT_KEY, merged);
  return merged;
}

// Effective per-product price map (cents), applying edited content over defaults.
function pricedProducts(content) {
  const priced = {};
  Object.keys(PRODUCTS).forEach(function (id) {
    const cents = id === "complete-collection" ? content.collectionCents : content.bottleCents;
    priced[id] = Object.assign({}, PRODUCTS[id], { priceInCents: cents });
  });
  return priced;
}

module.exports = { getContent, saveContent, defaults, pricedProducts, CONTENT_KEY };
