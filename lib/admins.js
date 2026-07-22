// Who can enter Edit Mode, and their role.
// (Super-admin will be able to manage this list from the admin panel later;
//  for now it's the starting allowlist. Emails are compared in lowercase.)
module.exports = {
  "pacserenaling@gmail.com": "admin",       // Serena — edit + publish + revert
  "reedserenaling@gmail.com": "admin",      // Serena (second email)
  "dling31@gmail.com": "admin",             // Dan Ling
  "pashin9444@gmail.com": "superadmin",     // Pashin — full control
};
