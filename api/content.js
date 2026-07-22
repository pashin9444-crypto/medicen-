// GET  /api/content            → public: current editable content (prices)
// POST /api/content { credential, content } → admin only: save + publish

const { getContent, saveContent, getHistory, revertTo } = require("../lib/content.js");
const { verifyGoogle, isAdmin } = require("../lib/auth.js");
const eventbrite = require("../lib/eventbrite.js");

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    const c = await getContent();
    // no-cache so edits show immediately
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(c);
  }

  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};

    const user = await verifyGoogle(body.credential);
    if (!user || !isAdmin(user.role)) {
      return res.status(403).json({ error: "You're not authorized to publish changes." });
    }
    try {
      if (body.action === "history") {
        const history = await getHistory();
        return res.status(200).json({ ok: true, history: history });
      }
      if (body.action === "revert") {
        // Any admin (Serena included) can revert to a past version.
        const restored = await revertTo(body.ts, user.email);
        if (!restored) return res.status(404).json({ error: "That version couldn't be found." });
        return res.status(200).json({ ok: true, content: restored });
      }
      let saved = await saveContent(body.content || {}, user.email);
      // If events changed and Eventbrite is configured, mirror them there and persist
      // any new Eventbrite ids. Best-effort — never blocks or fails the save.
      if (body.content && body.content.events !== undefined && eventbrite.configured) {
        try {
          const synced = await eventbrite.syncEvents(saved.events);
          if (synced && synced.changed) saved = await saveContent({ events: synced.events }, user.email, { skipHistory: true });
        } catch (e) { console.error("eventbrite sync error", e); }
      }
      return res.status(200).json({ ok: true, content: saved });
    } catch (e) {
      console.error("content save error", e);
      return res.status(500).json({ error: "Could not save your changes. Please try again." });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed." });
};
