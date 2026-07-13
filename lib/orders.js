// Pure helpers for the store: build Stripe line items from the SERVER price
// config, and build the three order emails. Kept free of Stripe/Brevo/network
// so they can be unit-tested directly.

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}
function money(cents) { return "$" + (Math.round(cents) / 100).toFixed(2); }

// Build Stripe line_items from a requested list [{id, qty}], pricing each item
// from PRODUCTS (server-side). Any price sent by the browser is ignored.
function buildLineItems(requested, PRODUCTS) {
  if (!Array.isArray(requested) || requested.length === 0) {
    const e = new Error("No product specified."); e.status = 400; throw e;
  }
  return requested.map(function (r) {
    const p = PRODUCTS[r.id];
    if (!p) { const e = new Error("Unknown product: " + r.id); e.status = 400; throw e; }
    return {
      price_data: {
        currency: "usd",
        product_data: { name: p.name, description: p.description },
        unit_amount: p.priceInCents, // <- SERVER price, never from the browser
      },
      quantity: Math.max(1, parseInt(r.qty, 10) || 1),
    };
  });
}

function fmtAddr(name, a) {
  if (!a) return { text: "(no address provided)", html: "(no address provided)" };
  const lines = [
    name,
    a.line1,
    a.line2,
    [a.city, a.state].filter(Boolean).join(", ") + (a.postal_code ? " " + a.postal_code : ""),
    a.country,
  ].filter(function (x) { return x && String(x).trim(); });
  return { text: lines.join("\n"), html: lines.map(esc).join("<br>") };
}

// Build the three emails fired on a completed order.
// o: { items:[{name,qty,amountCents}], buyerEmail, amountTotalCents,
//      shipName, shipAddress, shipByLabel, recipients:{owner,serena} }
function buildOrderEmails(o) {
  const items = o.items || [];
  const productName = items.length ? items[0].name : "Living Terrain order";
  const itemsText = items.length
    ? items.map(function (i) { return i.name + " × " + i.qty + " — " + money(i.amountCents); }).join("\n")
    : "(items unavailable)";
  const itemsHtml = items.length
    ? "<ul>" + items.map(function (i) { return "<li>" + esc(i.name) + " × " + i.qty + " — " + money(i.amountCents) + "</li>"; }).join("") + "</ul>"
    : "<p>(items unavailable)</p>";
  const total = money(o.amountTotalCents || 0);
  const addr = fmtAddr(o.shipName, o.shipAddress);
  const shipBy = o.shipByLabel || "soon";
  const buyerName = o.shipName || "";
  const buyerEmail = o.buyerEmail || "";
  const wrap = function (inner) { return '<div style="font-family:Georgia,serif;color:#33342c;max-width:560px">' + inner + "</div>"; };
  const fda = "† These statements have not been evaluated by the FDA. This product is not intended to diagnose, treat, cure, or prevent any disease.";

  const owner = {
    to: o.recipients.owner,
    subject: "🛒 New Living Terrain order — " + productName,
    text: "New order\n\nItems:\n" + itemsText + "\n\nAmount paid: " + total +
      "\nBuyer: " + buyerName + " <" + buyerEmail + ">\n\nShip to:\n" + addr.text,
    html: wrap('<h2 style="color:#2f3d2c">🛒 New order</h2>' + itemsHtml +
      "<p><strong>Amount paid:</strong> " + total + "</p>" +
      "<p><strong>Buyer:</strong> " + esc(buyerName) + " &lt;" + esc(buyerEmail) + "&gt;</p>" +
      "<p><strong>Ship to:</strong><br>" + addr.html + "</p>"),
  };

  const serena = {
    to: o.recipients.serena,
    subject: "New order to fulfill — " + productName,
    text: "Order to fulfill\n\nItems:\n" + itemsText + "\n\nShip to:\n" + addr.text +
      "\n\nBuyer: " + buyerName + " <" + buyerEmail + ">\nAmount: " + total,
    html: wrap('<h2 style="color:#2f3d2c">New order to fulfill</h2>' + itemsHtml +
      "<p><strong>Ship to:</strong><br>" + addr.html + "</p>" +
      "<p><strong>Buyer:</strong> " + esc(buyerName) + " &lt;" + esc(buyerEmail) + "&gt;</p>" +
      "<p><strong>Amount:</strong> " + total + "</p>"),
  };

  const buyer = {
    to: buyerEmail,
    subject: "Your Living Terrain order is confirmed 🌿",
    replyTo: "info@livingterrain.org",
    text: "Thank you for your order!\n\nWe hand-make every extract in small batches, so a little " +
      "care goes into getting yours ready.\n\nHere's what you ordered:\n" + itemsText +
      "\n\nTotal: " + total + "\nShips by " + shipBy + " to:\n" + addr.text +
      "\n\nQuestions? Just reply to this email.\n— Serena & the Living Terrain team\n\n" + fda,
    html: wrap('<h2 style="color:#2f3d2c">Your order is confirmed 🌿</h2>' +
      "<p>Thank you for your order! We hand-make every extract in small batches, so a little care goes into getting yours ready.</p>" +
      itemsHtml +
      "<p><strong>Total:</strong> " + total + "</p>" +
      "<p>Ships by <strong>" + esc(shipBy) + "</strong> to:<br>" + addr.html + "</p>" +
      "<p>Questions? Just reply to this email.</p>" +
      '<p style="color:#7d5f2c;font-style:italic">— Serena &amp; the Living Terrain team</p>' +
      '<p style="font-size:12px;color:#565644">' + esc(fda) + "</p>"),
  };

  return [owner, serena, buyer];
}

module.exports = { buildLineItems, buildOrderEmails, money, esc, fmtAddr };
