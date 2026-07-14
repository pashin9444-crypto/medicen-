// The Google OAuth **Client ID** is a PUBLIC value — it ships to every browser
// that shows the "Sign in with Google" button, so it is safe to keep in the repo.
// (This is NOT a secret key.) An env var GOOGLE_CLIENT_ID overrides it if set.
module.exports = {
  GOOGLE_CLIENT_ID:
    process.env.GOOGLE_CLIENT_ID ||
    "877617771174-f2l80u5f4fj84h89f3qbpv62tfqsjb4f.apps.googleusercontent.com",
};
