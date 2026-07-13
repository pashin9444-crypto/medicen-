// TEMPORARY diagnostic — safe: only ever emails NOTIFICATION_EMAIL (the owner).
// Remove this file once email sending is confirmed working.

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

module.exports = async function handler(req, res) {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.FROM_EMAIL || "info@livingterrain.org";
  const to = process.env.NOTIFICATION_EMAIL;
  const report = { brevoKeyPresent: !!apiKey, from: from, to: to };

  if (!apiKey) return res.status(200).json(Object.assign(report, { sent: false, reason: "BREVO_API_KEY is not set in Vercel" }));
  if (!to) return res.status(200).json(Object.assign(report, { sent: false, reason: "NOTIFICATION_EMAIL is not set in Vercel" }));

  try {
    const r = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: { "api-key": apiKey, "content-type": "application/json", "accept": "application/json" },
      body: JSON.stringify({
        sender: { name: "Living Terrain", email: from },
        to: [{ email: to }],
        subject: "Living Terrain — email self-test",
        htmlContent: "<p>If you can read this, Brevo sending works. ✅</p>",
        textContent: "If you can read this, Brevo sending works.",
      }),
    });
    const body = await r.text();
    return res.status(200).json(Object.assign(report, {
      sent: r.ok, brevoStatus: r.status, brevoResponse: body.slice(0, 500),
    }));
  } catch (e) {
    return res.status(200).json(Object.assign(report, { sent: false, error: String(e).slice(0, 300) }));
  }
};
