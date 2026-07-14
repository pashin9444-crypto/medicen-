// Tiny wrapper around the Upstash Redis REST API (the database Vercel connected).
// Uses the KV_REST_API_URL + KV_REST_API_TOKEN env vars Vercel injected — no SDK.
// Values are JSON-encoded so we can store objects (carts, orders) directly.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

const configured = !!(KV_URL && KV_TOKEN);

async function kvCommand(cmd) {
  if (!configured) throw new Error("KV not configured (missing KV_REST_API_URL / KV_REST_API_TOKEN)");
  const r = await fetch(KV_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + KV_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error("KV error " + r.status + ": " + (await r.text()).slice(0, 200));
  const data = await r.json();
  return data.result;
}

async function kvGet(key) {
  const v = await kvCommand(["GET", key]);
  if (v == null) return null;
  try { return JSON.parse(v); } catch (e) { return v; }
}
async function kvSet(key, value) {
  return kvCommand(["SET", key, JSON.stringify(value)]);
}
async function kvListPush(key, value) {
  return kvCommand(["RPUSH", key, JSON.stringify(value)]);
}
async function kvListAll(key) {
  const arr = await kvCommand(["LRANGE", key, "0", "-1"]);
  return (arr || []).map(function (s) { try { return JSON.parse(s); } catch (e) { return s; } });
}

module.exports = { configured, kvCommand, kvGet, kvSet, kvListPush, kvListAll };
