// Public config for the admin page. The Google Client ID is meant to live in the
// browser, so this is safe to expose.
const { GOOGLE_CLIENT_ID } = require("../lib/google.js");
module.exports = function handler(req, res) {
  res.status(200).json({ googleClientId: GOOGLE_CLIENT_ID });
};
