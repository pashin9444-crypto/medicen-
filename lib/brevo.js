// Brevo transactional email sender (HTTP API — no SDK dependency needed).
// All outbound Living Terrain mail goes through Brevo from info@livingterrain.org,
// because that is the domain verified with Brevo (SPF/DKIM/DMARC).
//
// Env: BREVO_API_KEY (secret), FROM_EMAIL (default info@livingterrain.org).

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

async function sendBrevoEmail(msg) {
  // msg: { to, subject, html, text, replyTo }
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || "info@livingterrain.org";
  if (!apiKey) {
    console.error("BREVO_API_KEY is not set — cannot send email.");
    return false;
  }
  try {
    const r = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        "accept": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Living Terrain", email: fromEmail },
        to: [{ email: msg.to }],
        replyTo: { email: msg.replyTo || fromEmail, name: "Living Terrain" },
        subject: msg.subject,
        htmlContent: msg.html,
        textContent: msg.text,
      }),
    });
    if (!r.ok) {
      const detail = await r.text();
      console.error("Brevo send failed", r.status, detail);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Brevo send error", err);
    return false;
  }
}

module.exports = { sendBrevoEmail };
