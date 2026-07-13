// POST /api/stripe-webhook
// Stripe calls this after a payment. We VERIFY the signature against the RAW
// body first, then on "checkout.session.completed" send THREE emails via Brevo:
//   1) owner alert   -> NOTIFICATION_EMAIL
//   2) Serena alert  -> SERENA_EMAIL
//   3) buyer confirm -> the email entered at checkout
//
// IMPORTANT: signature verification needs the raw, unparsed request body, so we
// turn OFF the automatic body parser for this route (config at the bottom) and
// read the stream ourselves.

const Stripe = require("stripe");
const { sendBrevoEmail } = require("../lib/brevo.js");
const { buildOrderEmails } = require("../lib/orders.js");

function getRawBody(req) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    req.on("data", function (c) { chunks.push(typeof c === "string" ? Buffer.from(c) : c); });
    req.on("end", function () { resolve(Buffer.concat(chunks)); });
    req.on("error", reject);
  });
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method not allowed.");
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !webhookSecret) {
    console.error("Webhook missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET.");
    return res.status(500).send("Webhook not configured.");
  }
  const stripe = Stripe(secret);

  // 1) Verify the signature FIRST — reject anything not genuinely from Stripe.
  let event;
  try {
    const raw = await getRawBody(req);
    const signature = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(raw, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send("Webhook Error: " + err.message);
  }

  // We only act on completed checkouts; acknowledge everything else.
  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ received: true });
  }

  // NOTE: Stripe can deliver the same event more than once. If duplicate emails
  // ever appear, add an idempotency guard here keyed on event.id (store handled
  // ids somewhere and skip repeats). Keeping it simple for now.
  try {
    const session = event.data.object;
    const buyerEmail = session.customer_details && session.customer_details.email;
    const shipDetails = session.shipping_details || session.collected_information || {};
    const shipAddress = (shipDetails && shipDetails.address) ||
      (session.customer_details && session.customer_details.address) || null;
    const shipName = (shipDetails && shipDetails.name) ||
      (session.customer_details && session.customer_details.name) || "";

    // Look up exactly what was bought.
    let items = [];
    try {
      const li = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
      items = li.data.map(function (x) {
        return { name: x.description, qty: x.quantity, amountCents: x.amount_total || 0 };
      });
    } catch (e) {
      console.error("Could not list line items:", e.message);
    }

    const shipByLabel = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

    const emails = buildOrderEmails({
      items: items,
      buyerEmail: buyerEmail,
      amountTotalCents: session.amount_total || 0,
      shipName: shipName,
      shipAddress: shipAddress,
      shipByLabel: shipByLabel,
      recipients: {
        owner: process.env.NOTIFICATION_EMAIL,
        serena: process.env.SERENA_EMAIL,
      },
    });

    // Send all three (buyer email only if we actually have one).
    for (const m of emails) {
      if (!m.to) continue;
      await sendBrevoEmail(m);
    }
  } catch (err) {
    // Log but still 200 so Stripe doesn't retry forever on our internal issue.
    console.error("Error handling checkout.session.completed:", err);
  }

  return res.status(200).json({ received: true });
}

module.exports = handler;
// Turn OFF Vercel's body parser so we can verify the raw Stripe payload.
module.exports.config = { api: { bodyParser: false } };
