// Optional Eventbrite integration.
//
// When Serena creates/updates a class or retreat and hits Publish, we mirror it to
// Eventbrite — same title, same wording, same picture — and payment/tickets live on
// Eventbrite. DISABLED until the token below is present, so the build/site work fine
// without it.
//
// ── To enable (Pashin) ──────────────────────────────────────────────────────────
//   Add in Vercel → Settings → Environment Variables (and/or local .env.local):
//     EVENTBRITE_API_TOKEN        = your private token
//         (Eventbrite → Account Settings → Developer → API Keys → "Your private token")
//   Optional (auto-detected from the token if omitted):
//     EVENTBRITE_ORGANIZATION_ID  = your organization id
//     EVENTBRITE_TIMEZONE         = America/Los_Angeles   (default)
//     EVENTBRITE_AUTO_PUBLISH     = "true"  to auto-publish (needs a paid/free ticket)
//     SITE_URL                    = https://www.livingterrain.org  (to resolve image URLs)
//   Redeploy. Each saved event is then created/updated on Eventbrite with its picture,
//   and its Eventbrite id is stored back on the event so future edits update in place.

const TOKEN = process.env.EVENTBRITE_API_TOKEN;
let ORG = process.env.EVENTBRITE_ORGANIZATION_ID || null;
const TZ = process.env.EVENTBRITE_TIMEZONE || "America/Los_Angeles";
const AUTO_PUBLISH = String(process.env.EVENTBRITE_AUTO_PUBLISH || "").toLowerCase() === "true";
const SITE_URL = (process.env.SITE_URL || "https://www.livingterrain.org").replace(/\/+$/, "");
const BASE = "https://www.eventbriteapi.com/v3";

// Only the token is required — the organization id is looked up automatically.
const configured = !!TOKEN;

async function api(path, method, body) {
  const r = await fetch(BASE + path, {
    method: method || "GET",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(function () { return {}; });
  if (!r.ok) throw new Error("Eventbrite " + r.status + ": " + JSON.stringify(data).slice(0, 300));
  return data;
}

async function resolveOrg() {
  if (ORG) return ORG;
  const d = await api("/users/me/organizations/", "GET");
  if (d && d.organizations && d.organizations.length) ORG = String(d.organizations[0].id);
  if (!ORG) throw new Error("No Eventbrite organization found for this token.");
  return ORG;
}

// "6:00 PM" → "18:00"; "10:00 AM" → "10:00"; empty → "18:00"
function parseTime(t) {
  const m = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(String(t || ""));
  if (!m) return "18:00";
  let h = parseInt(m[1], 10);
  const ap = (m[3] || "").toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return (h < 10 ? "0" + h : h) + ":" + m[2];
}

// Approximate UTC treating local as Pacific Daylight (-07:00). Good enough for scheduling.
function utcFromLocal(dateStr, hhmm, addHours) {
  const p = dateStr.split("-").map(Number);
  const hm = hhmm.split(":").map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2], hm[0] + 7 + (addHours || 0), hm[1], 0));
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function absImage(image) {
  if (!image) return null;
  if (/^https?:\/\//i.test(image)) return image;
  return SITE_URL + "/" + String(image).replace(/^\/+/, "");
}

function toPayload(e) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(e.date || ""))) return null; // needs a real date
  const hhmm = parseTime(e.time);
  const bits = [];
  if (e.duration) bits.push(e.duration);
  if (e.location) bits.push(e.location);
  const descHtml = String(e.desc || "") + (bits.length ? ("\n\n" + bits.join(" · ")) : "");
  return {
    event: {
      name: { html: String(e.title || "Living Terrain event").slice(0, 250) },
      description: { html: descHtml },
      summary: String(e.desc || "").replace(/\s+/g, " ").slice(0, 140),
      start: { timezone: TZ, utc: utcFromLocal(e.date, hhmm, 0) },
      end: { timezone: TZ, utc: utcFromLocal(e.date, hhmm, 2) },
      currency: "USD",
      online_event: false,
    },
  };
}

// Upload the event picture to Eventbrite and set it as the event logo. Best-effort.
async function setLogo(eventId, image) {
  const url = absImage(image);
  if (!url) return;
  // 1) ask Eventbrite where to upload
  const instr = await api("/media/upload/?type=image-event-logo", "GET");
  if (!instr || !instr.upload_url || !instr.upload_data) return;
  // 2) fetch the picture bytes and POST them to the given storage URL
  const imgResp = await fetch(url);
  if (!imgResp.ok) throw new Error("image fetch " + imgResp.status);
  const buf = Buffer.from(await imgResp.arrayBuffer());
  const form = new FormData();
  Object.keys(instr.upload_data).forEach(function (k) { form.append(k, instr.upload_data[k]); });
  const blob = new Blob([buf], { type: imgResp.headers.get("content-type") || "image/jpeg" });
  form.append(instr.file_parameter_name || "file", blob, "logo.jpg");
  const up = await fetch(instr.upload_url, { method: "POST", body: form });
  if (!up.ok) throw new Error("storage upload " + up.status);
  // 3) tell Eventbrite the upload is done → get a media id
  const media = await api("/media/upload/", "POST", { upload_token: instr.upload_token });
  if (media && media.id) {
    // 4) attach the logo to the event
    await api("/events/" + eventId + "/", "POST", { event: { logo_id: media.id } });
  }
}

// Create or update each dated event on Eventbrite (title, wording, picture). Returns
// { changed, events } with any new eventbriteId / ebImage to persist. Never throws.
async function syncEvents(events) {
  if (!configured || !Array.isArray(events)) return { changed: false, events: events };
  try { await resolveOrg(); } catch (e) { console.error("Eventbrite org lookup failed:", e.message); return { changed: false, events: events }; }
  let changed = false;
  const out = [];
  for (const e of events) {
    const payload = toPayload(e);
    if (!payload) { out.push(e); continue; }
    try {
      if (e.eventbriteId) {
        const upd = await api("/events/" + encodeURIComponent(e.eventbriteId) + "/", "POST", payload);
        const next = Object.assign({}, e);
        if (upd && upd.url && upd.url !== e.eventbriteUrl) { next.eventbriteUrl = upd.url; changed = true; }
        // update the picture only if it changed since last sync
        if (e.image && e.ebImage !== e.image) {
          try { await setLogo(e.eventbriteId, e.image); next.ebImage = e.image; changed = true; }
          catch (le) { console.error("Eventbrite logo update failed for", e.id, "-", le.message); }
        }
        out.push(next);
      } else {
        const created = await api("/organizations/" + encodeURIComponent(ORG) + "/events/", "POST", payload);
        const id = created && created.id ? String(created.id) : null;
        const next = Object.assign({}, e, { eventbriteId: id || undefined });
        if (created && created.url) next.eventbriteUrl = created.url;
        if (id && e.image) {
          try { await setLogo(id, e.image); next.ebImage = e.image; } catch (le) { console.error("Eventbrite logo set failed for", e.id, "-", le.message); }
        }
        if (id && AUTO_PUBLISH) { try { await api("/events/" + id + "/publish/", "POST", {}); } catch (pe) { /* needs a ticket class */ } }
        out.push(next);
        changed = changed || !!id;
      }
    } catch (err) {
      console.error("Eventbrite sync failed for", e.id, "-", err.message);
      out.push(e);
    }
  }
  return { changed: changed, events: out };
}

module.exports = { configured, syncEvents };
