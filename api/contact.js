// Vercel serverless function — receives the website contact/retreat form and
// sends it via Resend. The API key is read from the environment; it is NEVER
// exposed to the browser.
//
// Required env var:  RESEND_API_KEY
// Optional env vars: CONTACT_TO   (default info@livingterrain.org)
//                    CONTACT_FROM (default "Living Terrain <onboarding@resend.dev>")

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

  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  const to = process.env.CONTACT_TO || "info@livingterrain.org";
  const from = process.env.CONTACT_FROM || "Living Terrain <onboarding@resend.dev>";

  const esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  };

  const text =
    "New enquiry from the Living Terrain website\n\n" +
    "Name:  " + name + "\n" +
    "Email: " + email + "\n\n" +
    (message || "(no message)") + "\n";

  const html =
    '<div style="font-family:Georgia,serif;color:#33342c">' +
    '<h2 style="color:#2f3d2c">New enquiry from the Living Terrain website</h2>' +
    "<p><strong>Name:</strong> " + esc(name) + "</p>" +
    '<p><strong>Email:</strong> <a href="mailto:' + esc(email) + '">' + esc(email) + "</a></p>" +
    "<p><strong>Message:</strong><br>" + (message ? esc(message).replace(/\n/g, "<br>") : "(no message)") + "</p>" +
    "</div>";

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: from,
        to: [to],
        reply_to: email,
        subject: subject + " — " + name,
        text: text,
        html: html,
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error("Resend error", r.status, detail);
      return res.status(502).json({ error: "We couldn't send your message right now. Please email us directly." });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Contact function error", err);
    return res.status(502).json({ error: "We couldn't send your message right now. Please email us directly." });
  }
};
