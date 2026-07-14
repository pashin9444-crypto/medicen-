// POST /api/admin-verify  { credential: <google id token> }
// Verifies a "Sign in with Google" token server-side and checks the email against
// our allowlist. Returns { ok, email, role, name } or an error. This is the lock:
// only the allowlisted emails, with a genuine Google token for THIS site, get in.

const ADMINS = require("../lib/admins.js");

async function verifyGoogleToken(token, clientId) {
  // Low-volume admin logins → Google's tokeninfo endpoint is sufficient and needs
  // no extra library. It returns the decoded token only if the signature is valid.
  const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(token));
  if (!r.ok) return { ok: false, reason: "invalid" };
  const info = await r.json();
  if (info.aud !== clientId) return { ok: false, reason: "wrong-site" };
  if (info.email_verified !== "true" && info.email_verified !== true) return { ok: false, reason: "unverified" };
  if (info.exp && Number(info.exp) * 1000 < Date.now()) return { ok: false, reason: "expired" };
  return { ok: true, email: String(info.email || "").toLowerCase(), name: info.name || "" };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed." }); }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: "Sign-in isn't configured yet (missing GOOGLE_CLIENT_ID)." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const token = body.credential || body.token;
  if (!token) return res.status(400).json({ error: "Missing sign-in token." });

  try {
    const v = await verifyGoogleToken(token, clientId);
    if (!v.ok) return res.status(401).json({ error: "Sign-in could not be verified (" + v.reason + ")." });
    const role = ADMINS[v.email];
    if (!role) return res.status(403).json({ error: "This Google account isn't on the allowed list: " + v.email });
    return res.status(200).json({ ok: true, email: v.email, role: role, name: v.name });
  } catch (e) {
    console.error("admin-verify error", e);
    return res.status(500).json({ error: "Sign-in check failed. Please try again." });
  }
};
