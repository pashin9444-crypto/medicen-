// Verify a "Sign in with Google" ID token server-side and resolve the person's
// role from the allowlist. Returns { email, name, role } or null.
// role is "superadmin" | "admin" | "customer" (customer = any other Google user).

const ADMINS = require("./admins.js");
const { GOOGLE_CLIENT_ID } = require("./google.js");

async function verifyGoogle(token) {
  if (!token) return null;
  try {
    const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(token));
    if (!r.ok) return null;
    const info = await r.json();
    if (info.aud !== GOOGLE_CLIENT_ID) return null;
    if (info.email_verified !== "true" && info.email_verified !== true) return null;
    if (info.exp && Number(info.exp) * 1000 < Date.now()) return null;
    const email = String(info.email || "").toLowerCase();
    return { email: email, name: info.name || "", role: ADMINS[email] || "customer" };
  } catch (e) {
    return null;
  }
}

function isAdmin(role) { return role === "admin" || role === "superadmin"; }

module.exports = { verifyGoogle, isAdmin };
