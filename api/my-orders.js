// POST /api/my-orders { credential } → the signed-in customer's own past orders.
const { verifyGoogle } = require("../lib/auth.js");
const kv = require("../lib/kv.js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed." }); }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const user = await verifyGoogle(body.credential);
  if (!user) return res.status(401).json({ error: "Please sign in." });
  let orders = [];
  try { if (kv.configured) orders = await kv.kvListAll("orders:" + user.email); } catch (e) {}
  return res.status(200).json({ ok: true, orders: (orders || []).reverse() }); // newest first
};
