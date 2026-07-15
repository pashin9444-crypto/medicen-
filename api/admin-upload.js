// POST /api/admin-upload { credential, dataUrl } → admin uploads an image to
// Vercel Blob; returns a permanent public { url } to store as an image override.

const { verifyGoogle, isAdmin } = require("../lib/auth.js");
const { put } = require("@vercel/blob");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed." }); }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const user = await verifyGoogle(body.credential);
  if (!user || !isAdmin(user.role)) return res.status(403).json({ error: "Not authorized to upload." });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(500).json({ error: "Image storage isn't set up yet (add a Blob store in Vercel)." });

  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(body.dataUrl || "");
  if (!m) return res.status(400).json({ error: "Invalid image data." });
  const contentType = m[1];
  if (!/^image\//.test(contentType)) return res.status(400).json({ error: "That file isn't an image." });
  const buffer = Buffer.from(m[2], "base64");
  if (buffer.length > 4 * 1024 * 1024) return res.status(413).json({ error: "Image too large (keep under ~3 MB)." });

  const ext = (contentType.split("/")[1] || "png").replace(/[^a-z0-9]/gi, "");
  const name = "uploads/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
  try {
    const blob = await put(name, buffer, { access: "public", contentType: contentType, token: process.env.BLOB_READ_WRITE_TOKEN });
    return res.status(200).json({ ok: true, url: blob.url });
  } catch (e) {
    console.error("upload error", e);
    return res.status(500).json({ error: "Upload failed. Please try again." });
  }
};
