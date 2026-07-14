// POST /api/signin { credential }  → verify a Google sign-in for ANY user.
// Returns { ok, email, name, role }. role is "superadmin" | "admin" | "customer".
// This powers the site-wide "Sign in with Google" (customers + auto admin mode).

const { verifyGoogle } = require("../lib/auth.js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed." }); }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const user = await verifyGoogle(body.credential);
  if (!user) return res.status(401).json({ error: "Sign-in could not be verified." });
  return res.status(200).json({ ok: true, email: user.email, name: user.name, role: user.role });
};
