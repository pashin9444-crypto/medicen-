// Public config for the admin page. The Google Client ID is meant to live in the
// browser, so this is safe to expose. Returns "" if not set yet.
module.exports = function handler(req, res) {
  res.status(200).json({ googleClientId: process.env.GOOGLE_CLIENT_ID || "" });
};
