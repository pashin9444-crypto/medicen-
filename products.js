// ============================================================
// Living Terrain — PRODUCT CONFIG (single source of truth for prices)
//
// This is the ONE place to add/edit/remove products for the store.
// Prices are in CENTS (integer): $42.00 => 4200.
//
// SECURITY: the browser never sends a price — it sends only a product `id`,
// and the checkout endpoint looks the price up HERE, on the server.
//
// (Classes & retreats are ticketed through Eventbrite, so they are NOT here.)
// ============================================================

const PRODUCTS = {
  "daily-longevity": {
    name: "Daily Longevity",
    description: "Everyday resilience — 2 fl oz botanical extract",
    priceInCents: 4200,
  },
  "brain-power": {
    name: "Brain Power",
    description: "Neurocognitive support — 2 fl oz botanical extract",
    priceInCents: 4200,
  },
  "night-calm": {
    name: "Night Calm",
    description: "Rest & restoration — 2 fl oz botanical extract",
    priceInCents: 4200,
  },
  "acute-stress": {
    name: "Acute Stress",
    description: "Rapid adaptation — 2 fl oz botanical extract",
    priceInCents: 4200,
  },
  "headache-relief": {
    name: "Headache Relief",
    description: "Neurologic balance — 2 fl oz botanical extract",
    priceInCents: 4200,
  },
  "complete-collection": {
    name: "Complete Collection (all 5 extracts)",
    description: "One of each blend · 5 × 2 fl oz",
    priceInCents: 19000,
  },
};

module.exports = { PRODUCTS };
