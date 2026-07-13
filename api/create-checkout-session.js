// POST /api/create-checkout-session
// Body: { id } for a single product, OR { items: [{ id, qty }] } for the cart.
// The browser sends only product ids — prices come from ../products.js (server).
// Returns { url } (Stripe hosted Checkout); the frontend does window.location = url.

const Stripe = require("stripe");
const { PRODUCTS } = require("../products.js");
const { buildLineItems } = require("../lib/orders.js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return res.status(500).json({ error: "Payments are not configured yet. (Missing Stripe key.)" });
  }
  const stripe = Stripe(secret);

  // Body may arrive parsed or as a string.
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  // Normalize to a list of { id, qty }. Never trust any price in the body.
  let requested = [];
  if (Array.isArray(body.items)) {
    requested = body.items.map(function (i) { return { id: String(i.id), qty: i.qty }; });
  } else if (body.id) {
    requested = [{ id: String(body.id), qty: 1 }];
  }

  let line_items;
  try {
    line_items = buildLineItems(requested, PRODUCTS);
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }

  const site = process.env.SITE_URL || ("https://" + (req.headers.host || "livingterrain.org"));

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: line_items,
      success_url: site + "/success.html?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: site + "/products.html",
      // Collect where to ship + let Stripe Tax figure CA/Sacramento sales tax.
      shipping_address_collection: { allowed_countries: ["US"] },
      automatic_tax: { enabled: true },
      // Flat-rate shipping for now (easy to change / swap for live UPS later).
      shipping_options: [{
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: { amount: 800, currency: "usd" },
          display_name: "Standard shipping",
          delivery_estimate: {
            minimum: { unit: "business_day", value: 3 },
            maximum: { unit: "business_day", value: 7 },
          },
        },
      }],
      metadata: {
        order: requested.map(function (r) { return r.id + "×" + (parseInt(r.qty, 10) || 1); }).join(", "),
      },
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("create-checkout-session error", err);
    return res.status(500).json({ error: "Could not start checkout. Please try again." });
  }
};
