/* Living Terrain — small progressive-enhancement script.
   Mobile nav toggle + reveal-on-scroll. Everything degrades gracefully. */
(function () {
  "use strict";

  // Signal JS is available (used to opt out of reveal fallback if needed)
  document.documentElement.classList.remove("no-js");

  /* ---------- Mobile nav ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("primary-nav");

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    // Close the menu when a link is chosen (mobile)
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });

    // Close on Escape
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("open")) {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  /* ---------- Contact forms ----------
     Posts to the /api/contact serverless function (Resend). If that endpoint
     isn't available (e.g. the static preview server), falls back to a mailto. */
  var forms = document.querySelectorAll("form[data-contact]");
  forms.forEach(function (form) {
    var endpoint = form.getAttribute("data-endpoint") || "/api/contact";
    var to = form.getAttribute("data-recipient") || "info@livingterrain.org";
    var subject = form.getAttribute("data-subject") || "Website enquiry";

    var mailtoFallback = function (name, email, message, status) {
      var body =
        "Name: " + name + "\n" +
        "Email: " + email + "\n\n" +
        (message ? message + "\n" : "");
      window.location.href = "mailto:" + to +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(body);
      if (status) status.textContent = "Opening your email app so you can send this to us…";
    };

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = form.querySelector(".form-status");
      if (!form.checkValidity()) { form.reportValidity(); return; }

      var submitBtn = form.querySelector('button[type="submit"]');
      var name = (form.querySelector('[name="name"]') || {}).value || "";
      var email = (form.querySelector('[name="email"]') || {}).value || "";
      var message = (form.querySelector('[name="message"]') || {}).value || "";

      if (status) { status.style.color = ""; status.textContent = "Sending…"; }
      if (submitBtn) submitBtn.disabled = true;

      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name, email: email, message: message, subject: subject }),
      })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (data) {
            return { ok: r.ok, data: data };
          });
        })
        .then(function (res) {
          if (submitBtn) submitBtn.disabled = false;
          if (res.ok) {
            form.reset();
            if (status) status.textContent = "Thank you — we've received your message and will be in touch soon.";
          } else {
            if (status) { status.style.color = "#8f5836"; status.textContent = (res.data && res.data.error) || "Something went wrong. Please try again."; }
          }
        })
        .catch(function () {
          // Endpoint unreachable (e.g. static preview) — use mailto instead.
          if (submitBtn) submitBtn.disabled = false;
          mailtoFallback(name, email, message, status);
        });
    });
  });

  /* ---------- Hide season icons that fail to load (PNGs optional) ---------- */
  document.querySelectorAll(".season-icon img").forEach(function (img) {
    var fail = function () { img.style.display = "none"; };
    if (img.complete && img.naturalWidth === 0) fail();
    img.addEventListener("error", fail);
  });

  /* ---------- Reveal on scroll ---------- */
  var prefersReduced = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var revealables = document.querySelectorAll(".reveal");

  if (prefersReduced || !("IntersectionObserver" in window)) {
    // Show everything immediately
    revealables.forEach(function (el) { el.classList.add("in"); });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

  revealables.forEach(function (el) { io.observe(el); });
})();
