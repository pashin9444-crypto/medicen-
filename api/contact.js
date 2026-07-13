// Vercel serverless function — receives the website contact / sign-up / order
// form and sends it via Resend. The API key is read from the environment; it is
// NEVER exposed to the browser.
//
// Required env var:  RESEND_API_KEY
// Optional env vars: CONTACT_TO   (default info@livingterrain.org)
//                    CONTACT_FROM (default "Living Terrain <onboarding@resend.dev>")
//
// When the request body has `confirm: true`, a confirmation email is ALSO sent to
// the customer's address (used by store orders and class/retreat sign-ups). The
// response includes `confirmSent` so the site can tell the customer what happened.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

async function sendEmail(apiKey, msg) {
  const r = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(msg),
  });
  if (!r.ok) {
    const detail = await r.text();
    console.error("Resend error", r.status, detail);
    return false;
  }
  return true;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Email is not configured on the server." });
  }

  // Body may arrive parsed (object) or raw (string) depending on runtime.
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const message = String(body.message || "").trim();
  const subject = String(body.subject || "Website enquiry").trim();
  const kind = String(body.kind || "").trim();          // "order" | "class" | "retreat" | ""
  const item = String(body.item || "").trim();
  const wantConfirm = body.confirm === true || body.confirm === "true";

  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  const to = process.env.CONTACT_TO || "info@livingterrain.org";
  const from = process.env.CONTACT_FROM || "Living Terrain <onboarding@resend.dev>";

  // ---- 1) Notify the business ----
  const bizText =
    "New " + (kind || "enquiry") + " from the Living Terrain website\n\n" +
    "Name:  " + name + "\n" +
    "Email: " + email + "\n\n" +
    (message || "(no message)") + "\n";

  const bizHtml =
    '<div style="font-family:Georgia,serif;color:#33342c">' +
    '<h2 style="color:#2f3d2c">New ' + esc(kind || "enquiry") + ' from the Living Terrain website</h2>' +
    "<p><strong>Name:</strong> " + esc(name) + "</p>" +
    '<p><strong>Email:</strong> <a href="mailto:' + esc(email) + '">' + esc(email) + "</a></p>" +
    "<p><strong>Details:</strong><br>" + (message ? esc(message).replace(/\n/g, "<br>") : "(no message)") + "</p>" +
    "</div>";

  let bizOk = false;
  try {
    bizOk = await sendEmail(apiKey, {
      from: from,
      to: [to],
      reply_to: email,
      subject: subject + " — " + name,
      text: bizText,
      html: bizHtml,
    });
  } catch (err) {
    console.error("Business email error", err);
  }

  // ---- 2) Confirmation to the customer ----
  let confirmSent = false;
  if (wantConfirm) {
    const isOrder = kind === "order";
    const what = item || (isOrder ? "your order" : "your sign-up");
    // Kind-specific heading / subject / closing content.
    const content = {
      order: {
        heading: "Order confirmed",
        subject: "Your Living Terrain order confirmation",
        intro: "Thanks for your order! Here's a summary of what we received:",
        closing: "We'll email your tracking details as soon as your order ships — usually within 2–3 business days.",
      },
      class: {
        heading: "You're signed up!",
        subject: "Your Living Terrain class — confirmed",
        intro: "Thanks for signing up for a class! Here's what we received:",
        closing: "Please arrive about 10 minutes early and wear comfortable clothing — you've agreed to our class liability waiver. We'll send a reminder before your class.",
      },
      retreat: {
        heading: "Your retreat is reserved",
        subject: "Your Living Terrain retreat — confirmed",
        intro: "Thanks for reserving a retreat! Here's what we received:",
        closing: "We'll follow up with arrival details, what to bring, and deposit/balance information for your chosen location and room.",
      },
      subscription: {
        heading: "Welcome to the community",
        subject: "Welcome to Living Terrain",
        intro: "Thanks for joining! Here's what we set up:",
        closing: "Your member perks are active — enjoy your free monthly class and member discounts on classes, extracts, and retreats.",
      },
    };
    const c = content[kind] || {
      heading: "You're all set",
      subject: "Living Terrain — confirmation",
      intro: "Thanks for reaching out! Here's what we received:",
      closing: "We'll be in touch shortly.",
    };

    const custText =
      "Hi " + name + ",\n\n" + c.intro + "\n\n" + (message || what) + "\n\n" + c.closing +
      "\n\nQuestions? Just reply to this email or write to info@livingterrain.org." +
      "\n\n— Living Terrain\nRooted in nature. Backed by science. Made by a PA.";

    const custHtml =
      '<div style="font-family:Georgia,serif;color:#33342c;max-width:560px">' +
      '<h2 style="color:#2f3d2c">' + esc(c.heading) + "</h2>" +
      "<p>Hi " + esc(name) + ",</p>" +
      "<p>" + esc(c.intro) + "</p>" +
      '<div style="background:#f4eee0;border:1px solid #d8c9a6;border-radius:6px;padding:12px 16px;white-space:pre-wrap">' +
      esc(message || what) + "</div>" +
      "<p>" + esc(c.closing) + "</p>" +
      '<p style="font-size:13px;color:#565644">Questions? Just reply to this email or write to <a href="mailto:info@livingterrain.org">info@livingterrain.org</a>.</p>' +
      '<p style="color:#7d5f2c;font-style:italic">— Living Terrain · Rooted in nature. Backed by science. Made by a PA.</p>' +
      (isOrder || kind === "retreat" || kind === "class"
        ? '<p style="font-size:12px;color:#565644">This checkout is a demo — no card has been charged.</p>' : "") +
      "</div>";
    const custSubject = c.subject;

    try {
      confirmSent = await sendEmail(apiKey, {
        from: from,
        to: [email],
        reply_to: to,
        subject: custSubject,
        text: custText,
        html: custHtml,
      });
    } catch (err) {
      console.error("Customer confirmation error", err);
    }
  }

  if (!bizOk && !confirmSent) {
    return res.status(502).json({ error: "We couldn't send your message right now. Please email us directly.", confirmSent: false });
  }

  return res.status(200).json({ ok: true, confirmSent: confirmSent });
};
