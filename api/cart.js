// POST /api/cart { credential, action:"get"|"save", cart } → per-customer saved cart.
const { verifyGoogle } = require("../lib/auth.js");
const kv = require("../lib/kv.js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed." }); }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const user = await verifyGoogle(body.credential);
  if (!user) return res.status(401).json({ error: "Please sign in." });
  if (!kv.configured) return res.status(200).json({ ok: true, cart: [] });
  const key = "cart:" + user.email;
  try {
    if (body.action === "save") {
      await kv.kvSet(key, Array.isArray(body.cart) ? body.cart.slice(0, 50) : []);
      return res.status(200).json({ ok: true });
    }
    const cart = await kv.kvGet(key);
    return res.status(200).json({ ok: true, cart: Array.isArray(cart) ? cart : [] });
  } catch (e) {
    return res.status(200).json({ ok: true, cart: [] });
  }
};
