// TEMPORARY diagnostic — confirms the database connection works. Remove later.
const kv = require("../lib/kv.js");

module.exports = async function handler(req, res) {
  if (!kv.configured) return res.status(200).json({ configured: false, reason: "KV env vars not present in this deployment" });
  try {
    const key = "lt:selftest";
    await kv.kvSet(key, { ts: Date.now(), ok: true });
    const readBack = await kv.kvGet(key);
    return res.status(200).json({ configured: true, wrote: true, readBack: readBack });
  } catch (e) {
    return res.status(200).json({ configured: true, wrote: false, error: String(e).slice(0, 400) });
  }
};
