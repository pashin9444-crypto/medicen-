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

/* ============================================================
   Living Terrain — commerce (cart), product carousels,
   class/retreat sign-up, and demo checkout.
   Cart lives in localStorage; checkout is a skippable demo paywall.
   ============================================================ */
(function () {
  "use strict";

  var CART_KEY = "lt-cart";
  var CONTACT_ENDPOINT = "/api/contact";

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function setText(sel, txt, root) {
    var el = (root || document).querySelector(sel);
    if (el) el.textContent = txt;
  }
  function emailOk(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

  var cartRerender = null;
  function currentSession() {
    try { var s = JSON.parse(localStorage.getItem("lt-admin") || "null"); if (s && s.exp && s.exp < Date.now()) return null; return s; }
    catch (e) { return null; }
  }
  function readCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch (e) { return []; }
  }
  function writeCart(items) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (e) {}
    updateCartBadges();
    syncCartUp();
  }
  // If signed in, mirror the cart to the customer's account (so it follows them across devices).
  function syncCartUp() {
    var s = currentSession(); if (!s || !s.token) return;
    try { fetch("/api/cart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential: s.token, action: "save", cart: readCart() }) }).catch(function () {}); }
    catch (e) {}
  }
  function cartCount(items) {
    items = items || readCart();
    return items.reduce(function (n, it) { return n + it.qty; }, 0);
  }
  function cartTotal(items) {
    items = items || readCart();
    return items.reduce(function (s, it) { return s + it.qty * it.price; }, 0);
  }
  function addToCart(item) {
    var items = readCart(), found = null;
    for (var i = 0; i < items.length; i++) if (items[i].id === item.id) { found = items[i]; break; }
    if (found) found.qty += 1;
    else items.push({ id: item.id, name: item.name, price: item.price, img: item.img, qty: 1 });
    writeCart(items);
  }
  function adjustQty(id, delta) {
    var items = readCart();
    for (var i = 0; i < items.length; i++) if (items[i].id === id) {
      items[i].qty += delta;
      if (items[i].qty < 1) items.splice(i, 1);
      break;
    }
    writeCart(items);
  }
  function qtyInCart(id) {
    var items = readCart();
    for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i].qty;
    return 0;
  }
  function updateCartBadges() {
    var c = cartCount();
    document.querySelectorAll("[data-cart-count]").forEach(function (el) {
      el.textContent = c;
      if (c > 0) el.classList.add("has-items"); else el.classList.remove("has-items");
    });
  }
  var ORDER_INBOX = "info@livingterrain.org";
  // Builds a mailto to the business inbox so an order/sign-up is never lost if the
  // mail server can't be reached (e.g. static preview or an unverified domain).
  function inboxMailto(subjectLine, bodyText) {
    return "mailto:" + ORDER_INBOX +
      "?subject=" + encodeURIComponent(subjectLine) +
      "&body=" + encodeURIComponent(bodyText);
  }
  // Posts to /api/contact. When opts.confirm is true, the server also emails a
  // confirmation to the customer. Resolves to { ok, confirmSent } and never rejects.
  function sendContact(opts) {
    try {
      return fetch(CONTACT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts)
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          return { ok: r.ok, confirmSent: !!(data && data.confirmSent) };
        });
      }).catch(function () { return { ok: false, confirmSent: false }; });
    } catch (e) {
      return Promise.resolve({ ok: false, confirmSent: false });
    }
  }

  updateCartBadges();

  // If signed in, pull the saved cart and merge it with whatever's in this browser.
  (function pullCart() {
    var s = currentSession(); if (!s || !s.token) return;
    fetch("/api/cart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential: s.token, action: "get" }) })
      .then(function (r) { return r.json(); }).then(function (d) {
        if (!d || !d.ok || !Array.isArray(d.cart) || !d.cart.length) return;
        var map = {};
        readCart().forEach(function (it) { map[it.id] = it; });
        d.cart.forEach(function (it) { if (map[it.id]) map[it.id].qty = Math.max(map[it.id].qty, it.qty); else map[it.id] = it; });
        writeCart(Object.keys(map).map(function (k) { return map[k]; }));
        if (cartRerender) cartRerender();
      }).catch(function () {});
  })();

  /* ---------- Live content + admin inline Edit Mode ---------- */
  (function () {
    var MONEY = { bottle: "bottleCents", collection: "collectionCents", classPrice: "classPriceCents" };
    function money(cents) { return "$" + (cents / 100).toFixed(2).replace(/\.00$/, ""); }

    var PID = window.location.pathname.replace(/index\.html$/, "") || "/";

    // Real professional font library (loaded from Google Fonts on every page so
    // whatever Serena picks renders live for all visitors, not just in edit mode).
    var FONTS = [
      { label: "Default", value: "" },
      { label: "Playfair Display", value: '"Playfair Display", Georgia, serif' },
      { label: "Cormorant Garamond", value: '"Cormorant Garamond", Georgia, serif' },
      { label: "EB Garamond", value: '"EB Garamond", Georgia, serif' },
      { label: "Lora", value: '"Lora", Georgia, serif' },
      { label: "Source Serif", value: '"Source Serif 4", Georgia, serif' },
      { label: "Montserrat", value: '"Montserrat", system-ui, sans-serif' },
      { label: "Inter", value: '"Inter", system-ui, sans-serif' },
      { label: "Nunito Sans", value: '"Nunito Sans", system-ui, sans-serif' },
      { label: "Jost (labels)", value: '"Jost", system-ui, sans-serif' }
    ];
    var FONT_SIZES = [
      { label: "Default size", value: "" },
      { label: "XS · 0.8rem", value: "0.8rem" }, { label: "S · 0.95rem", value: "0.95rem" },
      { label: "M · 1.05rem", value: "1.05rem" }, { label: "L · 1.25rem", value: "1.25rem" },
      { label: "XL · 1.6rem", value: "1.6rem" }, { label: "2XL · 2rem", value: "2rem" },
      { label: "3XL · 2.6rem", value: "2.6rem" }, { label: "4XL · 3.2rem", value: "3.2rem" }
    ];
    (function loadFonts() {
      if (document.getElementById("lt-fonts")) return;
      var l = document.createElement("link"); l.id = "lt-fonts"; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,500&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&family=Montserrat:wght@400;500;600;700&family=Inter:wght@400;500;600&family=Nunito+Sans:wght@400;600;700&family=Jost:wght@400;500&display=swap";
      document.head.appendChild(l);
    })();

    // Searchable icon library (lucide-style, stroke = currentColor so it inherits
    // the surrounding colour). Each entry is the inner markup of a 0 0 24 24 SVG.
    var ICON_SET = {
      "leaf": '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.4 5.1-6C9.5 14.5 12 13 13 12"/>',
      "sprout": '<path d="M7 20h10"/><path d="M12 20c0-6 0-8 4-10"/><path d="M12 14c-4-1-6-3-6-7 4 0 6 2 6 6z"/><path d="M12 12c1-3 3-4 6-4 0 3-2 5-5 5"/>',
      "flower": '<circle cx="12" cy="12" r="2.4"/><path d="M12 9.6c0-3 1.5-4.5 0-6.6-1.5 2.1 0 3.6 0 6.6zM12 14.4c0 3-1.5 4.5 0 6.6 1.5-2.1 0-3.6 0-6.6zM9.6 12c-3 0-4.5 1.5-6.6 0 2.1-1.5 3.6 0 6.6 0zM14.4 12c3 0 4.5-1.5 6.6 0-2.1 1.5-3.6 0-6.6 0z"/>',
      "tree": '<path d="M12 3l5 7h-3l4 6H6l4-6H7z"/><path d="M12 16v5"/>',
      "mountain": '<path d="M3 20l6-11 4 6 2-3 6 8z"/>',
      "sun": '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
      "moon": '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
      "star": '<path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 21l1.1-6.5L2.6 9.8l6.5-.9z"/>',
      "sparkle": '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
      "heart": '<path d="M12 20s-7-4.3-9.3-9C1.2 8 2.5 4.5 6 4.5c2 0 3.2 1 4 2 .8-1 2-2 4-2 3.5 0 4.8 3.5 3.3 6.5C19 15.7 12 20 12 20z"/>',
      "pulse": '<path d="M3 12h4l3 8 4-16 3 8h4"/>',
      "droplet": '<path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z"/>',
      "flame": '<path d="M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-1.5 1-2.5 1-4 1 1 2 1 3 0-1-1.5-1-2.7 0-4z"/>',
      "wind": '<path d="M3 8h10a2.5 2.5 0 1 0-2.5-2.5M3 12h15a2.5 2.5 0 1 1-2.5 2.5M3 16h9a2.5 2.5 0 1 1-2.5 2.5"/>',
      "book": '<path d="M12 6C10 4.5 7 4 4 4.5v13C7 17 10 17.5 12 19M12 6c2-1.5 5-2 8-1.5v13c-3-.5-6 0-8 1.5M12 6v13"/>',
      "calendar": '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
      "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      "pin": '<path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
      "shield": '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>',
      "shield-check": '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
      "check": '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
      "users": '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 5.5a3 3 0 0 1 0 5M17 20a6 6 0 0 0-3-5"/>',
      "cap": '<path d="M12 4L2 9l10 5 10-5z"/><path d="M6 11v5c0 1 3 2.5 6 2.5s6-1.5 6-2.5v-5M22 9v5"/>',
      "palette": '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2 0-1.5 1-2 2-2h2a3 3 0 0 0 3-3c0-5-4-9-9-9z"/><circle cx="7.5" cy="12" r="1"/><circle cx="10" cy="8" r="1"/><circle cx="14.5" cy="8" r="1"/><circle cx="17" cy="12" r="1"/>',
      "music": '<path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="2.5"/><circle cx="16" cy="16" r="2.5"/>',
      "feather": '<path d="M20 4a5.5 5.5 0 0 0-8 0L5 11v8h8l7-7a5.5 5.5 0 0 0 0-8z"/><path d="M16 8L4 20M12 8h4v4"/>',
      "flask": '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7 15h10"/>',
      "pill": '<path d="M10.5 20.5a5 5 0 0 1-7-7l3-3 7 7z"/><path d="M13.5 3.5a5 5 0 0 1 7 7l-3 3-7-7z"/>',
      "coffee": '<path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 9h2a2.5 2.5 0 0 1 0 5h-2"/><path d="M7 3v2M11 3v2"/>',
      "gift": '<rect x="3" y="8" width="18" height="4"/><path d="M5 12v9h14v-9M12 8v13"/><path d="M12 8S11 3 8.5 3 6 6 6 6s2 2 6 2zM12 8s1-5 3.5-5S18 6 18 6s-2 2-6 2z"/>',
      "home": '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/>',
      "mail": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M4 7l8 6 8-6"/>',
      "compass": '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'
    };

    // Block-level text units (edited as a whole so inline <strong>/<em>/<a> stay intact),
    // plus the standalone-text classes used around the site. Scoped to the content
    // area AND the footer, so effectively all page copy is editable.
    var TEXT_SEL = "h1,h2,h3,h4,h5,h6,p,li,td,th,dt,dd,blockquote,figcaption,caption,legend," +
      ".lede,.tagline,.eyebrow,.m-name,.m-eyebrow,.season-when,.time,.act,.ro-name,.ro-sub," +
      ".clip-tag,.num,.fmt,.cal-note,.cal-hint,.join-price,.pw-note,.tw-partner,.tw-cobrand-head," +
      ".tw-blurb,.statement,.disclaimer,.footer-legal,.footer-disclaimer,.amt,.big,.per,.sub-price," +
      ".card-link,.tw-link,.opt,.ro-price,.btn";
    var TEXT_SCOPE = ["#main", ".site-footer"];
    function textNodes() {
      var scoped = TEXT_SCOPE.map(function (s) { return TEXT_SEL.split(",").map(function (t) { return s + " " + t.trim(); }).join(","); }).join(",");
      return Array.prototype.slice.call(document.querySelectorAll(scoped)).filter(function (el) {
        if (el.textContent.trim().length === 0) return false;
        if (el.hasAttribute("data-edit") || el.querySelector("[data-edit]")) return false; // don't clobber prices/times
        if (el.closest(".lt-editbar") || el.closest(".lt-history") || el.closest(".lt-picker")) return false;
        if (el.closest("[data-events-grid]") || el.closest("[data-events-upcoming]") || el.closest("[data-events-admin]")) return false; // events edited via their own editor
        if (el.matches("button, [data-add-to-cart], [data-buy-now]")) return false; // leave interactive controls alone
        if (el.closest("[data-classlink]") || el.hasAttribute("data-classlink")) return false; // priced links are managed
        if (el.querySelector(TEXT_SEL)) return false; // only the innermost text block (keeps structure intact)
        return true;
      });
    }
    function applyTexts(texts) {
      if (!texts) return;
      var nodes = textNodes();
      Object.keys(texts).forEach(function (key) {
        if (key.indexOf(PID + "#t") !== 0) return;
        var i = parseInt(key.slice((PID + "#t").length), 10);
        var el = nodes[i]; if (!el) return;
        var t = texts[key];
        if (t.orig != null && el.textContent.trim() !== String(t.orig).trim()) return; // structure changed → skip (safe)
        if (t.text != null) el.innerHTML = t.text;
        if (t.color) el.style.color = t.color;
        if (t.font) el.style.fontFamily = t.font;
        if (t.size) el.style.fontSize = t.size;
      });
    }

    // Icons: any inline SVG inside the content area is swappable.
    function iconEls() {
      return Array.prototype.slice.call(document.querySelectorAll("#main svg")).filter(function (el) {
        return !el.closest(".lt-editbar") && !el.closest(".lt-history") && !el.closest(".lt-picker") &&
        !el.closest("[data-events-grid]") && !el.closest("[data-events-upcoming]") && !el.closest("[data-events-admin]");
      });
    }
    function setIcon(el, name) {
      if (!ICON_SET[name]) return;
      el.setAttribute("viewBox", "0 0 24 24");
      el.innerHTML = ICON_SET[name];
    }
    function applyIcons(icons) {
      if (!icons) return;
      var els = iconEls();
      Object.keys(icons).forEach(function (key) {
        if (key.indexOf(PID + "#ico") !== 0) return;
        var i = parseInt(key.slice((PID + "#ico").length), 10);
        var el = els[i]; if (!el) return;
        var o = icons[key]; if (!o || !o.name) return;
        if (o.orig != null && el.innerHTML.trim() !== String(o.orig).trim()) return; // structure changed → skip (safe)
        setIcon(el, o.name);
      });
    }

    function logoEls() { return Array.prototype.slice.call(document.querySelectorAll("img.brand-logo, .footer-logo img")); }
    function mainImgs() { return Array.prototype.slice.call(document.querySelectorAll("#main img")); }
    function applyImages(images) {
      if (!images) return;
      if (images["site.logo"] && images["site.logo"].url) logoEls().forEach(function (el) { el.src = images["site.logo"].url; });
      mainImgs().forEach(function (el, i) {
        var o = images[PID + "#img" + i]; if (!o || !o.url) return;
        if (o.orig != null && el.getAttribute("src") !== o.orig) return; // structure changed → skip (safe)
        el.src = o.url;
      });
    }

    function apply(c) {
      document.querySelectorAll("[data-edit]").forEach(function (el) {
        var key = el.getAttribute("data-edit");
        if (MONEY[key]) el.textContent = money(c[MONEY[key]]);
        else if (c.classWhen && c.classWhen[key] != null) el.textContent = c.classWhen[key];
      });
      document.querySelectorAll("[data-add-to-cart],[data-buy-now]").forEach(function (btn) {
        var id = btn.getAttribute("data-id");
        var cents = id === "complete-collection" ? c.collectionCents : c.bottleCents;
        btn.setAttribute("data-price", String(cents / 100));
      });
      document.querySelectorAll("[data-classlink]").forEach(function (a) {
        a.textContent = "Sign up · " + money(c.classPriceCents);
        try {
          var u = new URL(a.getAttribute("href"), window.location.origin);
          u.searchParams.set("price", String(c.classPriceCents / 100));
          a.setAttribute("href", u.pathname + "?" + u.searchParams.toString());
        } catch (e) {}
      });
      if (c.icons) applyIcons(c.icons);
      if (c.texts) applyTexts(c.texts);
      if (c.images) applyImages(c.images);
      if (window.LTEvents && typeof window.LTEvents.apply === "function") window.LTEvents.apply(c);
    }

    fetch("/api/content").then(function (r) { return r.json(); })
      .then(function (c) { if (c && typeof c.bottleCents === "number") { window.LT_CONTENT = c; apply(c); } initEdit(); })
      .catch(function () { initEdit(); });

    function admin() {
      try { var a = JSON.parse(localStorage.getItem("lt-admin") || "null"); return (a && (a.role === "admin" || a.role === "superadmin")) ? a : null; }
      catch (e) { return null; }
    }

    function initEdit() {
      var who = admin();
      if (!who) return;
      var editables = document.querySelectorAll("[data-edit]");
      var bar = document.createElement("div");
      bar.className = "lt-editbar";
      bar.innerHTML =
        '<span class="lt-eb-role">' + (who.role === "superadmin" ? "Super-admin" : "Admin") + "</span>" +
        '<button type="button" class="lt-eb-btn" data-eb-toggle>✎ Edit mode: off</button>' +
        '<button type="button" class="lt-eb-btn lt-eb-primary" data-eb-publish hidden>Publish</button>' +
        '<input type="color" class="lt-eb-color" data-eb-color hidden title="Text colour">' +
        '<select class="lt-eb-font" data-eb-font hidden aria-label="Font family"></select>' +
        '<select class="lt-eb-font" data-eb-size hidden aria-label="Font size"></select>' +
        '<span class="lt-eb-hint" data-eb-iconhint hidden>Click any icon to swap it</span>' +
        '<button type="button" class="lt-eb-btn" data-eb-history>History</button>' +
        '<span class="lt-eb-status" data-eb-status></span>' +
        '<button type="button" class="lt-eb-link" data-eb-signout>Sign out</button>';
      document.body.appendChild(bar);

      // ----- Change log + revert -----
      var histWrap = document.createElement("div");
      histWrap.className = "lt-history"; histWrap.hidden = true;
      histWrap.innerHTML = '<div class="lt-history-box"><div class="lt-history-head"><strong>Change history</strong><button type="button" class="lt-eb-link" data-hist-close>Close</button></div><div class="lt-history-list" data-hist-list>Loading…</div></div>';
      document.body.appendChild(histWrap);
      // Real change log: diff each version against the one before it and show the
      // actual fields that changed (field · old → new). No generic placeholders.
      function plainText(html) { var d = document.createElement("div"); d.innerHTML = html || ""; return (d.textContent || "").replace(/\s+/g, " ").trim(); }
      function trunc(s, n) { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n) + "…" : s; }
      function fontLabel(v) { if (!v) return "default"; for (var i = 0; i < FONTS.length; i++) if (FONTS[i].value === v) return FONTS[i].label; return String(v).replace(/["']/g, "").split(",")[0]; }
      function uniqKeys(a, b) { var m = {}, out = []; Object.keys(a || {}).concat(Object.keys(b || {})).forEach(function (k) { if (!m[k]) { m[k] = 1; out.push(k); } }); return out; }
      var PAGE_NAMES = { "/": "Home", "/index.html": "Home", "/about.html": "About", "/classes.html": "Classes", "/retreats.html": "Retreats", "/products.html": "Extracts", "/resources.html": "Resources", "/recipes.html": "Recipes", "/signup.html": "Sign-up", "/privacy.html": "Privacy", "/cart.html": "Cart", "/success.html": "Success" };
      function pageLabel(key) { var path = String(key || "").split("#")[0]; if (PAGE_NAMES[path]) return PAGE_NAMES[path]; return path.replace(/^\//, "").replace(/\.html$/, "") || "Home"; }
      function q(s) { return '“' + trunc(s || "—", 220) + '”'; }
      function eventsById(list) { var m = {}; (list || []).forEach(function (e) { if (e && e.id) m[e.id] = e; }); return m; }
      function diffSnap(a, b) { // a = newer, b = older
        a = a || {}; b = b || {};
        var out = [];
        [["bottleCents", "Bottle price"], ["collectionCents", "Collection price"], ["classPriceCents", "Class price"]].forEach(function (p) {
          if ((a[p[0]] || 0) !== (b[p[0]] || 0)) out.push({ f: p[1], from: "$" + ((b[p[0]] || 0) / 100), to: "$" + ((a[p[0]] || 0) / 100) });
        });
        uniqKeys(a.classWhen, b.classWhen).forEach(function (k) {
          var av = (a.classWhen || {})[k] || "", bv = (b.classWhen || {})[k] || "";
          if (av !== bv) out.push({ f: "Class time", from: bv || "—", to: av || "—" });
        });
        // Text edits — show the page and the exact wording that changed (long is fine).
        uniqKeys(a.texts, b.texts).forEach(function (k) {
          var av = (a.texts || {})[k] || {}, bv = (b.texts || {})[k] || {}, pg = pageLabel(k);
          if (plainText(av.text) !== plainText(bv.text)) out.push({ page: pg, f: "Text edited", from: q(plainText(bv.text)), to: q(plainText(av.text)) });
          if ((av.color || "") !== (bv.color || "")) out.push({ page: pg, f: "Text colour", from: bv.color || "default", to: av.color || "default" });
          if ((av.font || "") !== (bv.font || "")) out.push({ page: pg, f: "Font", from: fontLabel(bv.font), to: fontLabel(av.font) });
          if ((av.size || "") !== (bv.size || "")) out.push({ page: pg, f: "Font size", from: bv.size || "default", to: av.size || "default" });
        });
        uniqKeys(a.images, b.images).forEach(function (k) {
          var av = (a.images || {})[k] || {}, bv = (b.images || {})[k] || {};
          if ((av.url || "") !== (bv.url || "")) out.push({ page: pageLabel(k), f: "Image", from: bv.url ? "a previous image" : "the original", to: av.url ? "a new uploaded image" : "the original" });
        });
        uniqKeys(a.icons, b.icons).forEach(function (k) {
          var av = (a.icons || {})[k] || {}, bv = (b.icons || {})[k] || {};
          if ((av.name || "") !== (bv.name || "")) out.push({ page: pageLabel(k), f: "Icon", from: bv.name || "original", to: av.name || "original" });
        });
        // Events / retreats — per-event, field-by-field (e.g. date 2026-08-23 → 2026-08-24).
        var ea = eventsById(a.events), eb = eventsById(b.events);
        uniqKeys(ea, eb).forEach(function (id) {
          var av = ea[id], bv = eb[id];
          if (av && !bv) { out.push({ page: "Classes", f: "Added " + (av.type || "class"), from: "—", to: q(av.title) }); return; }
          if (!av && bv) { out.push({ page: "Classes", f: "Removed " + (bv.type || "class"), from: q(bv.title), to: "—" }); return; }
          var label = "Event " + q(bv.title || av.title);
          [["title", "title"], ["date", "date"], ["time", "time"], ["duration", "duration"], ["priceDollars", "price"], ["location", "location"], ["note", "note"], ["type", "type"], ["color", "colour"]].forEach(function (p) {
            if (String(av[p[0]] == null ? "" : av[p[0]]) !== String(bv[p[0]] == null ? "" : bv[p[0]])) out.push({ page: "Classes", f: label + " — " + p[1], from: (bv[p[0]] == null || bv[p[0]] === "" ? "—" : String(bv[p[0]])), to: (av[p[0]] == null || av[p[0]] === "" ? "—" : String(av[p[0]])) });
          });
          if (plainText(av.desc) !== plainText(bv.desc)) out.push({ page: "Classes", f: label + " — description", from: q(plainText(bv.desc)), to: q(plainText(av.desc)) });
          if ((av.image || "") !== (bv.image || "")) out.push({ page: "Classes", f: label + " — image", from: "previous", to: "new image" });
        });
        return out;
      }
      bar.querySelector("[data-eb-history]").addEventListener("click", function () {
        histWrap.hidden = false;
        var list = histWrap.querySelector("[data-hist-list]");
        list.textContent = "Loading…";
        fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential: who.token, action: "history" }) })
          .then(function (r) { return r.json(); }).then(function (d) {
            if (!d.ok || !d.history || !d.history.length) { list.textContent = "No saved versions yet."; return; }
            list.innerHTML = "";
            d.history.forEach(function (s, i) {
              var when = s.updatedAt ? new Date(s.updatedAt).toLocaleString() : "—";
              var by = s.updatedBy || "—";
              var changes = diffSnap(s, d.history[i + 1]); // compare to the previous (older) version
              var row = document.createElement("div"); row.className = "lt-history-row";
              var changeHtml;
              if (i === d.history.length - 1) changeHtml = "<em>First saved version</em>";
              else if (!changes.length) changeHtml = "<em>No field-level changes recorded</em>";
              else changeHtml = changes.slice(0, 60).map(function (c) {
                return '<span class="lt-h-change">' + (c.page ? '<b class="lt-h-page">' + esc(c.page) + '</b> ' : "") + '<b>' + esc(c.f) + ':</b> ' + esc(c.from) + ' → ' + esc(c.to) + '</span>';
              }).join("") + (changes.length > 60 ? '<span class="lt-h-change">…and ' + (changes.length - 60) + ' more</span>' : "");
              var left = document.createElement("div");
              left.innerHTML = '<div class="lt-h-when">' + esc(when) + (i === 0 ? " · current" : "") + ' — <em>' + esc(by) + '</em></div><div class="lt-h-sum">' + changeHtml + '</div>';
              row.appendChild(left);
              if (i !== 0) {
                var b = document.createElement("button"); b.type = "button"; b.className = "lt-eb-btn"; b.textContent = "Revert to this";
                b.addEventListener("click", function () {
                  if (!window.confirm("Revert the site to this version?")) return;
                  b.textContent = "Reverting…";
                  fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential: who.token, action: "revert", ts: s.updatedAt }) })
                    .then(function (r) { return r.json(); }).then(function (res) {
                      if (res.ok && res.content) { apply(res.content); histWrap.hidden = true; st.textContent = "✅ Reverted — live now. Reloading…"; setTimeout(function () { window.location.reload(); }, 900); }
                      else { b.textContent = "Failed"; }
                    }).catch(function () { b.textContent = "Failed"; });
                });
                row.appendChild(b);
              }
              list.appendChild(row);
            });
          }).catch(function () { list.textContent = "Couldn't load history."; });
      });
      histWrap.querySelector("[data-hist-close]").addEventListener("click", function () { histWrap.hidden = true; });

      var editing = false, pending = {};
      var toggle = bar.querySelector("[data-eb-toggle]"), pub = bar.querySelector("[data-eb-publish]"), st = bar.querySelector("[data-eb-status]");
      var colorCtl = bar.querySelector("[data-eb-color]"), fontCtl = bar.querySelector("[data-eb-font]");
      var sizeCtl = bar.querySelector("[data-eb-size]"), iconHint = bar.querySelector("[data-eb-iconhint]");
      FONTS.forEach(function (f) { var o = document.createElement("option"); o.value = f.value; o.textContent = f.label; fontCtl.appendChild(o); });
      FONT_SIZES.forEach(function (f) { var o = document.createElement("option"); o.value = f.value; o.textContent = f.label; sizeCtl.appendChild(o); });

      // ----- Click-in-place TEXT editing (+ colour, font family & size) -----
      var tNodes = textNodes();
      var activeText = null;
      function rgbToHex(rgb) { var m = (rgb || "").match(/\d+/g); if (!m || m.length < 3) return null; return "#" + m.slice(0, 3).map(function (x) { var h = parseInt(x, 10).toString(16); return h.length < 2 ? "0" + h : h; }).join(""); }
      function stageText(el) {
        var i = tNodes.indexOf(el); if (i < 0) return;
        var key = PID + "#t" + i;
        pending.texts = pending.texts || {};
        var entry = pending.texts[key] || {};
        entry.orig = el.dataset.ltOrig;
        entry.text = el.innerHTML;
        if (el.style.color) entry.color = el.style.color;
        if (el.style.fontFamily) entry.font = el.style.fontFamily;
        if (el.style.fontSize) entry.size = el.style.fontSize;
        pending.texts[key] = entry;
        st.textContent = "Edited — click Publish to make it live.";
      }
      tNodes.forEach(function (el) {
        el.addEventListener("click", function (e) {
          if (!editing) return;
          e.preventDefault(); // don't follow links / submit buttons while editing
          if (el.dataset.ltOrig == null) el.dataset.ltOrig = el.textContent;
          activeText = el;
          el.setAttribute("contenteditable", "true");
          el.focus();
          try { colorCtl.value = rgbToHex(getComputedStyle(el).color) || "#33342c"; } catch (e2) {}
          fontCtl.value = el.style.fontFamily || "";
          sizeCtl.value = el.style.fontSize || "";
        });
        el.addEventListener("input", function () { if (editing) stageText(el); });
        el.addEventListener("blur", function () { el.removeAttribute("contenteditable"); });
      });
      colorCtl.addEventListener("input", function () { if (activeText) { activeText.style.color = colorCtl.value; stageText(activeText); } });
      fontCtl.addEventListener("change", function () { if (activeText) { activeText.style.fontFamily = fontCtl.value; stageText(activeText); } });
      sizeCtl.addEventListener("change", function () { if (activeText) { activeText.style.fontSize = sizeCtl.value; stageText(activeText); } });

      // ----- Click an image (or the logo) to replace it -----
      var imgEls = logoEls().map(function (el) { return { el: el, key: "site.logo" }; })
        .concat(mainImgs().map(function (el, i) { return { el: el, key: PID + "#img" + i }; }));
      var fileInput = document.createElement("input"); fileInput.type = "file"; fileInput.accept = "image/*"; fileInput.style.display = "none";
      document.body.appendChild(fileInput);
      var uploadTarget = null;
      imgEls.forEach(function (o) {
        o.el.addEventListener("click", function (e) {
          if (!editing) return;
          e.preventDefault();
          uploadTarget = o;
          if (o.el.dataset.ltImgOrig == null) o.el.dataset.ltImgOrig = o.el.getAttribute("src");
          fileInput.value = ""; fileInput.click();
        });
      });
      fileInput.addEventListener("change", function () {
        var f = fileInput.files && fileInput.files[0]; if (!f || !uploadTarget) return;
        if (f.size > 3 * 1024 * 1024) { st.textContent = "That image is too big — keep it under 3 MB."; return; }
        st.textContent = "Uploading image…";
        var reader = new FileReader();
        reader.onload = function () {
          fetch("/api/admin-upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential: who.token, dataUrl: reader.result }) })
            .then(function (r) { return r.json(); }).then(function (d) {
              if (d.ok && d.url) {
                var o = uploadTarget;
                if (o.key === "site.logo") logoEls().forEach(function (el) { el.src = d.url; }); else o.el.src = d.url;
                pending.images = pending.images || {};
                pending.images[o.key] = { orig: o.el.dataset.ltImgOrig, url: d.url };
                st.textContent = "Image added — click Publish to make it live.";
              } else { st.textContent = d.error || "Upload failed."; }
            }).catch(function () { st.textContent = "Upload failed. Please try again."; });
        };
        reader.readAsDataURL(f);
      });

      // ----- Click an icon to swap it (searchable, lucide-style set) -----
      var icoEls = iconEls().map(function (el, i) { return { el: el, key: PID + "#ico" + i }; });
      var iconTarget = null;
      var picker = document.createElement("div");
      picker.className = "lt-picker lt-history"; picker.hidden = true;
      picker.innerHTML = '<div class="lt-history-box"><div class="lt-history-head"><strong>Choose an icon</strong><button type="button" class="lt-eb-link" data-ico-close>Close</button></div>' +
        '<input type="search" class="lt-ico-search" data-ico-search placeholder="Search icons (leaf, sun, heart…)" aria-label="Search icons">' +
        '<div class="lt-ico-grid" data-ico-grid></div></div>';
      document.body.appendChild(picker);
      var icoGrid = picker.querySelector("[data-ico-grid]");
      var icoSearch = picker.querySelector("[data-ico-search]");
      function renderIconGrid(q) {
        q = (q || "").toLowerCase().trim();
        icoGrid.innerHTML = "";
        Object.keys(ICON_SET).forEach(function (name) {
          if (q && name.indexOf(q) < 0) return;
          var b = document.createElement("button"); b.type = "button"; b.className = "lt-ico-opt"; b.title = name;
          b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON_SET[name] + '</svg><span>' + name + '</span>';
          b.addEventListener("click", function () {
            if (!iconTarget) return;
            var o = iconTarget;
            if (o.el.dataset.ltIcoOrig == null) o.el.dataset.ltIcoOrig = o.el.innerHTML;
            setIcon(o.el, name);
            pending.icons = pending.icons || {};
            pending.icons[o.key] = { orig: o.el.dataset.ltIcoOrig, name: name };
            picker.hidden = true;
            st.textContent = "Icon changed — click Publish to make it live.";
          });
          icoGrid.appendChild(b);
        });
        if (!icoGrid.children.length) icoGrid.innerHTML = '<p style="grid-column:1/-1;color:var(--ink-soft)">No icons match that search.</p>';
      }
      icoSearch.addEventListener("input", function () { renderIconGrid(icoSearch.value); });
      picker.querySelector("[data-ico-close]").addEventListener("click", function () { picker.hidden = true; });
      picker.addEventListener("click", function (e) { if (e.target === picker) picker.hidden = true; });
      icoEls.forEach(function (o) {
        o.el.addEventListener("click", function (e) {
          if (!editing) return;
          e.preventDefault(); e.stopPropagation();
          iconTarget = o;
          icoSearch.value = ""; renderIconGrid("");
          picker.hidden = false; icoSearch.focus();
        });
      });

      toggle.addEventListener("click", function () {
        editing = !editing;
        document.body.classList.toggle("lt-editing", editing);
        toggle.textContent = "✎ Edit mode: " + (editing ? "on" : "off");
        pub.hidden = !editing;
        colorCtl.hidden = !editing; fontCtl.hidden = !editing; sizeCtl.hidden = !editing; iconHint.hidden = !editing;
        tNodes.forEach(function (el) { el.classList.toggle("lt-tedit", editing); if (!editing) el.removeAttribute("contenteditable"); });
        imgEls.forEach(function (o) { o.el.classList.toggle("lt-iedit", editing); });
        icoEls.forEach(function (o) { o.el.classList.toggle("lt-icoedit", editing); });
        if (!editing) picker.hidden = true;
        st.textContent = editing ? "Click any highlighted text, price, time, image, or icon to change it." : "";
      });
      bar.querySelector("[data-eb-signout]").addEventListener("click", function () {
        try { localStorage.removeItem("lt-admin"); } catch (e) {}
        window.location.reload();
      });

      editables.forEach(function (el) {
        el.addEventListener("click", function () {
          if (!editing) return;
          var key = el.getAttribute("data-edit"), isMoney = !!MONEY[key];
          var cur = el.textContent.replace(/[$,]/g, "").trim();
          var val = window.prompt(isMoney ? "New price, in dollars:" : "New date / time:", cur);
          if (val === null) return;
          if (isMoney) {
            var n = Math.round(parseFloat(val) * 100);
            if (!isFinite(n) || n < 0) { st.textContent = "Please enter a valid number."; return; }
            pending[MONEY[key]] = n; el.textContent = money(n);
            if (key === "classPrice") document.querySelectorAll("[data-classlink]").forEach(function (a) { a.textContent = "Sign up · " + money(n); });
          } else {
            pending.classWhen = pending.classWhen || {}; pending.classWhen[key] = val.trim(); el.textContent = val.trim();
          }
          st.textContent = "Edited — click Publish to make it live.";
        });
      });

      pub.addEventListener("click", function () {
        if (!Object.keys(pending).length) { st.textContent = "No changes to publish yet."; return; }
        st.textContent = "Publishing…";
        fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential: who.token, content: pending }) })
          .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
          .then(function (res) {
            if (res.ok && res.d.ok) { pending = {}; apply(res.d.content); st.textContent = "✅ Published — live now."; }
            else { st.textContent = (res.d.error || "Couldn't publish.") + (/authoriz/i.test(res.d.error || "") ? " Your sign-in may have expired — click Sign out, then Sign in with Google at the top of the page and try again." : ""); }
          }).catch(function () { st.textContent = "Error publishing. Please try again."; });
      });
    }
  })();

  /* ---------- Add to cart / Buy now (products page) ---------- */
  function itemFrom(btn) {
    return {
      id: btn.getAttribute("data-id"),
      name: btn.getAttribute("data-name"),
      price: parseFloat(btn.getAttribute("data-price")),
      img: btn.getAttribute("data-img")
    };
  }
  document.querySelectorAll("[data-add-to-cart]").forEach(function (btn) {
    var id = btn.getAttribute("data-id");
    // Build an inline − / qty / + stepper that replaces the button once in the cart.
    var stepper = document.createElement("div");
    stepper.className = "qty-stepper";
    stepper.innerHTML =
      '<button type="button" data-dec aria-label="Decrease quantity">−</button>' +
      '<span data-qty>0</span>' +
      '<button type="button" data-inc aria-label="Increase quantity">+</button>';
    btn.parentNode.insertBefore(stepper, btn.nextSibling);
    function sync() {
      var q = qtyInCart(id);
      if (q > 0) {
        btn.hidden = true; stepper.hidden = false;
        stepper.querySelector("[data-qty]").textContent = q;
      } else {
        btn.hidden = false; stepper.hidden = true;
      }
    }
    btn.addEventListener("click", function () { addToCart(itemFrom(btn)); sync(); });
    stepper.querySelector("[data-inc]").addEventListener("click", function () { adjustQty(id, 1); sync(); });
    stepper.querySelector("[data-dec]").addEventListener("click", function () { adjustQty(id, -1); sync(); });
    sync();
  });
  // Send the shopper to Stripe's hosted checkout. Payload is { id } for a single
  // product or { items:[{id,qty}] } for the cart — never any price (server prices it).
  function startCheckout(payload, btn) {
    var sess = currentSession();
    if (sess && sess.email) payload.email = sess.email; // attribute the order to the signed-in customer
    var orig = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "Redirecting…"; }
    return fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (r.ok && data.url) { window.location.assign(data.url); return; }
        throw new Error(data.error || "Checkout is unavailable right now.");
      });
    }).catch(function (err) {
      if (btn) { btn.disabled = false; btn.textContent = orig; }
      alert(err.message || "Sorry, checkout is unavailable right now. Please try again, or email info@livingterrain.org.");
    });
  }

  document.querySelectorAll("[data-buy-now]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      startCheckout({ id: btn.getAttribute("data-id") }, btn);
    });
  });

  /* ---------- Payment field formatting (demo checkout) ---------- */
  document.querySelectorAll('input[name="card"]').forEach(function (el) {
    el.setAttribute("inputmode", "numeric");
    el.setAttribute("maxlength", "19");
    el.setAttribute("autocomplete", "cc-number");
    el.addEventListener("input", function () {
      var d = el.value.replace(/\D/g, "").slice(0, 16);
      el.value = d.replace(/(\d{4})(?=\d)/g, "$1 ");
    });
  });
  document.querySelectorAll('input[name="exp"]').forEach(function (el) {
    el.setAttribute("inputmode", "numeric");
    el.setAttribute("maxlength", "7"); // "MM / YY"
    el.setAttribute("autocomplete", "cc-exp");
    el.addEventListener("input", function (e) {
      var deleting = e.inputType && e.inputType.indexOf("delete") === 0;
      var d = el.value.replace(/\D/g, "").slice(0, 4);
      if (d.length > 2) el.value = d.slice(0, 2) + " / " + d.slice(2);
      else if (d.length === 2) el.value = deleting ? d : d + " / ";
      else el.value = d;
    });
  });
  document.querySelectorAll('input[name="cvc"]').forEach(function (el) {
    el.setAttribute("inputmode", "numeric");
    el.setAttribute("maxlength", "3");
    el.setAttribute("autocomplete", "cc-csc");
    el.addEventListener("input", function () {
      el.value = el.value.replace(/\D/g, "").slice(0, 3);
    });
  });

  /* ---------- Product image carousels (Amazon-style) ---------- */
  document.querySelectorAll("[data-carousel]").forEach(function (root) {
    var track = root.querySelector(".carousel-track");
    var imgs = Array.prototype.slice.call(root.querySelectorAll(".carousel-track img"));
    if (!track || !imgs.length) return;
    var thumbsWrap = root.querySelector(".thumbs");
    var idx = 0;

    function go(n) {
      idx = (n + imgs.length) % imgs.length;
      track.style.transform = "translateX(" + (-idx * 100) + "%)";
      if (thumbsWrap) {
        thumbsWrap.querySelectorAll("button").forEach(function (b, i) {
          b.setAttribute("aria-current", i === idx ? "true" : "false");
        });
      }
    }
    var prev = root.querySelector(".cbtn.prev");
    var next = root.querySelector(".cbtn.next");
    if (prev) prev.addEventListener("click", function () { go(idx - 1); });
    if (next) next.addEventListener("click", function () { go(idx + 1); });
    if (imgs.length < 2) {
      if (prev) prev.style.display = "none";
      if (next) next.style.display = "none";
    }
    if (thumbsWrap) {
      imgs.forEach(function (img, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.setAttribute("aria-label", "View image " + (i + 1));
        var t = document.createElement("img");
        t.src = img.getAttribute("src"); t.alt = "";
        b.appendChild(t);
        b.addEventListener("click", function () { go(i); });
        thumbsWrap.appendChild(b);
      });
    }
    go(0);
  });

  /* ---------- Sign-up page (classes / retreats) ---------- */
  var signup = document.querySelector("[data-signup]");
  if (signup) {
    var params = new URLSearchParams(window.location.search);
    var type = params.get("type") || "class";
    var item = params.get("item") || "Living Terrain";
    var price = params.get("price");
    var when = params.get("when");
    var typeLabels = {
      class: { eyebrow: "Class sign-up", label: "Class" },
      retreat: { eyebrow: "Retreat sign-up", label: "Retreat" },
      subscription: { eyebrow: "Membership sign-up", label: "Membership" }
    };
    var L = typeLabels[type] || { eyebrow: "Sign up", label: "Item" };
    var fmtPrice = function (p) {
      if (!p) return "Free";
      var n = parseFloat(p);
      if (isNaN(n)) return "$" + p;
      var s = (Math.round(n * 100) % 100 === 0) ? String(Math.round(n)) : n.toFixed(2);
      return "$" + s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    // Note: the eyebrow and <h1> live in the page-hero, outside [data-signup],
    // so these resolve against the whole document, not the signup container.
    setText("[data-su-eyebrow]", L.eyebrow);
    setText("[data-su-item]", item);
    setText("[data-su-label]", L.label, signup);
    setText("[data-su-name]", item, signup);
    var whenRow = signup.querySelector("[data-su-when-row]");
    if (when) setText("[data-su-when]", when, signup);
    else if (whenRow) whenRow.hidden = true;

    // Retreat sign-ups let you choose a location and room type (which sets the price).
    var currentPrice = price;
    var retreatOpts = signup.querySelector("[data-retreat-opts]");
    if (type === "retreat" && retreatOpts) {
      retreatOpts.hidden = false;
      var applyRoom = function () {
        var picked = retreatOpts.querySelector('input[name="room"]:checked');
        if (picked) currentPrice = picked.getAttribute("data-price");
        setText("[data-su-price]", fmtPrice(currentPrice), signup);
      };
      retreatOpts.querySelectorAll('input[name="room"]').forEach(function (r) {
        r.addEventListener("change", applyRoom);
      });
      applyRoom(); // set price from the default-checked room
    } else {
      setText("[data-su-price]", fmtPrice(price), signup);
    }

    var suForm = signup.querySelector("#signup-form");
    var suView = signup.querySelector("[data-signup-view]");
    var suConfirm = signup.querySelector("[data-confirm]");
    var suStatus = suForm.querySelector(".form-status");

    // Classes require a signed liability waiver.
    var waiver = signup.querySelector("[data-waiver]");
    if (type === "class" && waiver) waiver.hidden = false;

    var completeSignup = function (skipped) {
      var name = (suForm.querySelector('[name="name"]').value || "").trim();
      var email = (suForm.querySelector('[name="email"]').value || "").trim();
      if (!name || !email || !emailOk(email)) { suForm.reportValidity(); return; }
      var waiverAgreed = "n/a";
      if (waiver && !waiver.hidden) {
        var wi = waiver.querySelector("[data-waiver-input]");
        if (wi && !wi.checked) {
          if (suStatus) { suStatus.style.color = "#8f5836"; suStatus.textContent = "Please read and agree to the liability waiver to sign up for a class."; }
          var det = waiver.querySelector(".waiver-details"); if (det) det.open = true;
          wi.focus();
          return;
        }
        // Record who accepted and exactly when, with the booking.
        var waiverTime = new Date();
        waiverAgreed = "AGREED by " + name + " on " + waiverTime.toLocaleString() + " (" + waiverTime.toISOString() + ")";
        var ack = waiver.querySelector("[data-waiver-ack]");
        if (ack) { ack.hidden = false; ack.textContent = "✓ Waiver accepted by " + name + " on " + waiverTime.toLocaleString() + "."; }
      }
      var phone = (suForm.querySelector('[name="phone"]').value || "").trim();
      var retreatDetail = "";
      if (type === "retreat" && retreatOpts) {
        var loc = retreatOpts.querySelector("[data-retreat-location]").value;
        var picked = retreatOpts.querySelector('input[name="room"]:checked');
        retreatDetail = "\nLocation: " + loc + "\nRoom: " + (picked ? picked.value : "—");
      }
      var subject = L.eyebrow + ": " + item;
      var message = "Sign-up for: " + item + (when ? " (" + when + ")" : "") +
        (currentPrice ? " — " + fmtPrice(currentPrice) : "") +
        retreatDetail +
        "\nPhone: " + (phone || "—") +
        (waiverAgreed !== "n/a" ? "\nWaiver: " + waiverAgreed : "") +
        "\nPayment: " + (skipped ? "skipped (pay later)" : "demo — collected on site");
      var msgEl = suConfirm.querySelector("[data-confirm-msg]");
      msgEl.textContent = "Thank you, " + name + " — you're signed up for " + item + ". Sending your confirmation email…";
      suView.hidden = true;
      suConfirm.hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
      sendContact({
        subject: subject, name: name, email: email, message: message,
        confirm: true, kind: type, item: item
      }).then(function (res) {
        if (res.ok) {
          msgEl.textContent = "Thank you, " + name + " — you're signed up for " + item + ". " +
            (res.confirmSent
              ? "A confirmation email is on its way to " + email + "."
              : "We've noted your sign-up and will follow up at " + email + " shortly.");
        } else {
          var link = inboxMailto(subject, message + "\n\nFrom: " + name + " <" + email + ">");
          msgEl.innerHTML = "Thank you, " + esc(name) + " — your sign-up is saved. We couldn't reach our mail server automatically; <a href=\"" + link + "\">tap here to email it to " + ORDER_INBOX + "</a> and we'll take it from there.";
        }
      });
    };
    suForm.addEventListener("submit", function (e) { e.preventDefault(); completeSignup(false); });
    var suSkip = signup.querySelector("[data-skip-pay]");
    if (suSkip) suSkip.addEventListener("click", function () { completeSignup(true); });
  }

  /* ---------- Cart page (checkout hands off to Stripe) ---------- */
  var cartView = document.querySelector("[data-cart-view]");
  if (cartView) {
    var itemsWrap = document.querySelector("[data-cart-items]");
    var emptyMsg = document.querySelector("[data-cart-empty]");
    var totalRow = document.querySelector("[data-cart-total-row]");
    var totalEl = document.querySelector("[data-cart-total]");
    var actions = document.querySelector("[data-cart-actions]");

    var renderCart = function () {
      var items = readCart();
      itemsWrap.innerHTML = "";
      if (!items.length) {
        emptyMsg.hidden = false; totalRow.hidden = true; actions.hidden = true; return;
      }
      emptyMsg.hidden = true; totalRow.hidden = false; actions.hidden = false;
      items.forEach(function (it) {
        var row = document.createElement("div");
        row.className = "cart-item";
        row.innerHTML =
          '<div class="ci-thumb"><img src="' + esc(it.img) + '" alt=""></div>' +
          '<div><h3>' + esc(it.name) + '</h3>' +
          '<p class="ci-sub">Botanical extract · 2 fl oz</p>' +
          '<div class="cart-qty"><button type="button" data-dec aria-label="Decrease quantity">−</button>' +
          '<span>' + it.qty + '</span>' +
          '<button type="button" data-inc aria-label="Increase quantity">+</button></div></div>' +
          '<div><div class="ci-price">$' + (it.qty * it.price) + '</div>' +
          '<button type="button" class="ci-remove" data-remove>Remove</button></div>';
        row.querySelector("[data-inc]").addEventListener("click", function () { changeQty(it.id, 1); });
        row.querySelector("[data-dec]").addEventListener("click", function () { changeQty(it.id, -1); });
        row.querySelector("[data-remove]").addEventListener("click", function () { removeItem(it.id); });
        itemsWrap.appendChild(row);
      });
      totalEl.textContent = "$" + cartTotal(items);
    };
    var changeQty = function (id, delta) {
      var items = readCart();
      for (var i = 0; i < items.length; i++) if (items[i].id === id) {
        items[i].qty += delta;
        if (items[i].qty < 1) items.splice(i, 1);
        break;
      }
      writeCart(items); renderCart();
    };
    var removeItem = function (id) {
      writeCart(readCart().filter(function (it) { return it.id !== id; }));
      renderCart();
    };
    cartRerender = renderCart; // let the account cart-sync refresh this page
    renderCart();

    var gotoCheckout = document.querySelector("[data-goto-checkout]");
    if (gotoCheckout) gotoCheckout.addEventListener("click", function () {
      var items = readCart();
      if (!items.length) return;
      // Hand off to Stripe's hosted checkout with the cart contents (ids + qty only).
      startCheckout({ items: items.map(function (it) { return { id: it.id, qty: it.qty }; }) }, gotoCheckout);
    });
  }
})();

/* ============================================================
   Site-wide "Sign in with Google" (in the header, every page).
   Optional for customers (saves cart/orders later); if the signed-in
   email is an admin/super-admin, the Edit bar auto-appears on reload.
   Session is stored in localStorage under "lt-admin".
   ============================================================ */
(function siteAuth() {
  "use strict";
  var KEY = "lt-admin";
  function getSession() {
    try { var s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && s.exp && s.exp < Date.now()) { localStorage.removeItem(KEY); return null; } return s; }
    catch (e) { return null; }
  }
  function setSession(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function clearSession() { try { localStorage.removeItem(KEY); } catch (e) {} }
  function firstName(n) { return (String(n || "").split(" ")[0]) || "there"; }

  var nav = document.querySelector(".site-header .nav");
  if (!nav) return; // pages without the standard header
  var slot = document.createElement("span");
  slot.className = "auth-slot";
  nav.appendChild(slot);

  function loadGis(cb) {
    if (window.google && google.accounts && google.accounts.id) { cb(); return; }
    if (!document.getElementById("gis-script")) {
      var sc = document.createElement("script"); sc.id = "gis-script";
      sc.src = "https://accounts.google.com/gsi/client"; sc.async = true;
      document.head.appendChild(sc);
    }
    var tries = 0;
    (function wait() { if (window.google && google.accounts && google.accounts.id) cb(); else if (tries++ < 60) setTimeout(wait, 100); })();
  }

  function onCredential(resp) {
    fetch("/api/signin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential: resp.credential }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ok) {
          setSession({ email: d.email, name: d.name, role: d.role, token: resp.credential, exp: Date.now() + 55 * 60 * 1000 });
          window.location.reload();
        }
      }).catch(function () {});
  }

  var s = getSession();
  if (s) {
    slot.innerHTML = '<span class="auth-hi">Hi, ' + firstName(s.name) + '</span> ' +
      '<button type="button" class="auth-btn" data-myorders>My orders</button> ' +
      '<button type="button" class="auth-btn" data-signout>Sign out</button>';
    slot.querySelector("[data-signout]").addEventListener("click", function () {
      clearSession();
      if (window.google && google.accounts && google.accounts.id) { try { google.accounts.id.disableAutoSelect(); } catch (e) {} }
      window.location.reload();
    });
    slot.querySelector("[data-myorders]").addEventListener("click", function () {
      var m = document.createElement("div"); m.className = "lt-history";
      m.innerHTML = '<div class="lt-history-box"><div class="lt-history-head"><strong>My orders</strong><button type="button" class="lt-eb-link" data-close>Close</button></div><div class="lt-history-list">Loading…</div></div>';
      document.body.appendChild(m);
      m.querySelector("[data-close]").addEventListener("click", function () { m.remove(); });
      m.addEventListener("click", function (e) { if (e.target === m) m.remove(); });
      var list = m.querySelector(".lt-history-list");
      fetch("/api/my-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential: s.token }) })
        .then(function (r) { return r.json(); }).then(function (d) {
          if (!d.ok || !d.orders || !d.orders.length) { list.textContent = "No orders yet."; return; }
          list.innerHTML = "";
          d.orders.forEach(function (o) {
            var when = o.date ? new Date(o.date).toLocaleDateString() : "";
            var itemsTxt = (o.items || []).map(function (i) { return i.name + " ×" + i.qty; }).join(", ");
            var total = "$" + ((o.totalCents || 0) / 100).toFixed(2);
            var row = document.createElement("div"); row.className = "lt-history-row";
            row.innerHTML = "<div><div class='lt-h-when'>" + when + "</div><div class='lt-h-sum'></div></div>";
            row.querySelector(".lt-h-sum").textContent = (itemsTxt || "—") + " — " + total;
            list.appendChild(row);
          });
        }).catch(function () { list.textContent = "Couldn't load your orders."; });
    });
    return;
  }

  // Signed-out: a "Sign in" pill that opens the Google button, plus the auto popup.
  slot.innerHTML = '<button type="button" class="auth-btn auth-signin" data-signin>Sign in</button>' +
    '<div class="auth-pop" data-authpop hidden><p>Sign in to save your cart &amp; see your orders.</p><div id="gbtn-header"></div></div>';
  var pop = slot.querySelector("[data-authpop]");
  slot.querySelector("[data-signin]").addEventListener("click", function () {
    pop.hidden = !pop.hidden;
    if (!pop.hidden && window.google && google.accounts && google.accounts.id) {
      try { google.accounts.id.renderButton(document.getElementById("gbtn-header"), { theme: "filled_black", size: "large", shape: "pill", text: "signin_with" }); } catch (e) {}
      try { google.accounts.id.prompt(); } catch (e) {}
    }
  });

  fetch("/api/config").then(function (r) { return r.json(); }).then(function (cfg) {
    if (!cfg.googleClientId) return;
    loadGis(function () {
      google.accounts.id.initialize({ client_id: cfg.googleClientId, callback: onCredential, auto_select: false });
      try { google.accounts.id.prompt(); } catch (e) {} // the "Sign in with Google" popup on arrival
    });
  }).catch(function () {});
})();

/* ============================================================
   Living Terrain — data-driven Classes / Retreats / Events.
   Renders the schedule + detail cards from stored content.events
   (dynamic, current dates — no sample data). Admins get add / edit /
   reorder / duplicate / delete + 6 quick-add templates, and each save
   is (optionally) pushed to Eventbrite server-side.
   ============================================================ */
(function LTEventsModule() {
  "use strict";
  var content = null;
  var grid = null; // resolved on first render

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function admin() { try { var a = JSON.parse(localStorage.getItem("lt-admin") || "null"); if (a && a.exp && a.exp < Date.now()) return null; return (a && (a.role === "admin" || a.role === "superadmin")) ? a : null; } catch (e) { return null; } }
  function money(n) { var s = (Math.round(n * 100) % 100 === 0) ? String(Math.round(n)) : Number(n).toFixed(2); return "$" + s.replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function dateObj(e) { if (!e.date) return null; var p = e.date.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fmtWhen(e) {
    var d = dateObj(e), out = "";
    if (d && !isNaN(d)) out = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    if (e.time) out += (out ? " · " : "") + e.time;
    if (!out) out = "Date to be announced";
    return out;
  }
  function isPast(e) { var d = dateObj(e); if (!d) return false; var today = new Date(); today.setHours(0, 0, 0, 0); return d < today; }
  function sorted(events) {
    return events.slice().sort(function (a, b) {
      var da = dateObj(a), db = dateObj(b);
      if (!da && !db) return 0; if (!da) return 1; if (!db) return -1;
      return da - db;
    });
  }
  function signupHref(e) {
    // If the event is live on Eventbrite, booking + payment happen there.
    if (e.eventbriteUrl) return e.eventbriteUrl;
    var q = "type=" + encodeURIComponent(e.type) + "&item=" + encodeURIComponent(e.title) +
      "&price=" + encodeURIComponent(e.priceDollars || 0) +
      "&when=" + encodeURIComponent(fmtWhen(e) + (e.duration ? " · " + e.duration : ""));
    return "signup.html?" + q;
  }
  function signupAttrs(e) { return e.eventbriteUrl ? ' target="_blank" rel="noopener"' : ""; }
  function signupLabel(e) { return (e.eventbriteUrl ? "Get tickets · " : "Sign up · ") + money(e.priceDollars || 0); }
  var CAL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>';

  // 6 professional presets (title, description, duration, default image).
  var TEMPLATES = [
    { key: "herbal", label: "Herbal Medicine Workshop", type: "class", image: "assets/class-apothecary.jpg", duration: "2 hours", desc: "A hands-on workshop on safe, evidence-informed herbal medicine — how to choose, prepare, and combine botanicals for everyday wellness, with take-home notes and simple recipes." },
    { key: "mushrooms", label: "Medicinal Mushrooms Class", type: "class", image: "assets/class-mushrooms.jpg", duration: "2 hours", desc: "Explore functional mushrooms — Reishi, Lion's Mane, Turkey Tail, Cordyceps and more — for immunity, focus, stress, and longevity, and how to tell quality products from hype." },
    { key: "plantwalk", label: "Plant Walk / Foraging Outing", type: "class", image: "assets/hero-meadow.jpg", duration: "2 hours · outdoors", desc: "A guided outdoor walk to identify local medicinal and edible plants, learn respectful and sustainable harvesting, and connect traditional uses with modern evidence." },
    { key: "retreat", label: "Multi-Day Wellness Retreat", type: "retreat", image: "assets/tex-pebbles.jpg", duration: "Weekend · 2 nights", desc: "An immersive retreat blending medicine-making, gentle movement, breathwork, nourishing vegetarian food, and restorative time in nature. Leave with extracts you made and daily routines you can sustain." },
    { key: "nutrition", label: "Nutrition & Herbalism Seminar", type: "class", image: "assets/class-gut-health.jpg", duration: "2 hours", desc: "A practical seminar connecting nutrition and herbalism — foods, botanicals, and supplements that support gut health, energy, and resilience, plus how to build a routine without overwhelm." },
    { key: "seasonal", label: "Seasonal / Community Class", type: "class", image: "assets/class-focus-memory.jpg", duration: "2 hours", desc: "A welcoming, seasonally themed community class — practical wellness rooted in the rhythm of the year. Approachable, evidence-informed, and open to all experience levels." },
  ];

  function eventsList() { return (content && Array.isArray(content.events)) ? content.events : []; }

  function apply(c) { content = c; render(); }
  window.LTEvents = { apply: apply };

  function render() {
    grid = document.querySelector("[data-events-grid]");
    if (!grid) return; // not the classes hub
    var upcoming = document.querySelector("[data-events-upcoming]");
    var countEl = document.querySelector("[data-events-count]");
    var adminWrap = document.querySelector("[data-events-admin]");
    var events = eventsList();
    var who = admin();

    // ----- Detail cards (in stored order) -----
    grid.innerHTML = "";
    if (!events.length) {
      grid.innerHTML = '<p class="cal-note center" style="grid-column:1/-1">No classes or retreats are scheduled right now — check back soon.</p>';
    }
    events.forEach(function (e, i) {
      var card = document.createElement("article");
      card.className = "class-card reveal in" + (isPast(e) ? " lt-ev-past" : "");
      card.id = e.id;
      var num = String(i + 1); if (num.length < 2) num = "0" + num;
      var img = e.image || "assets/hero-meadow.jpg";
      var typeTag = e.type === "retreat" ? '<span class="lt-ev-type">Retreat</span>' : "";
      card.innerHTML =
        '<div class="thumb"><img src="' + esc(img) + '" alt="' + esc(e.title) + '" loading="lazy"></div>' +
        '<div class="card-inner">' +
          '<span class="num">' + num + '</span>' + typeTag +
          '<h3>' + esc(e.title) + '</h3>' +
          '<p class="class-when">' + CAL_SVG + ' <span>' + esc(fmtWhen(e)) + (isPast(e) ? " · past" : "") + '</span></p>' +
          '<p>' + esc(e.desc) + '</p>' +
          (e.location ? '<p style="font-size:0.92rem"><strong>Location:</strong> ' + esc(e.location) + '</p>' : "") +
          (e.note ? '<p style="font-size:0.92rem;color:var(--bronze-deep);font-style:italic">' + esc(e.note) + '</p>' : "") +
          (e.duration ? '<span class="fmt" style="margin-top:auto">' + esc(e.duration) + '</span>' : "") +
          '<a class="btn btn-primary" style="margin-top:1rem;align-self:flex-start"' + signupAttrs(e) + ' href="' + esc(signupHref(e)) + '">' + esc(signupLabel(e)) + '</a>' +
        '</div>';
      if (who) card.appendChild(adminControls(e, i, events));
      grid.appendChild(card);
    });

    // ----- Upcoming schedule (sorted, past separated) -----
    if (upcoming) {
      var srt = sorted(events);
      var up = srt.filter(function (e) { return !isPast(e); });
      var past = srt.filter(isPast).reverse().slice(0, 4);
      var html = "";
      if (up.length) {
        html += '<ul class="lt-ev-sched">' + up.map(scheduleRow).join("") + "</ul>";
      } else {
        html += '<p class="cal-note">No upcoming dates are posted yet.</p>';
      }
      if (past.length) {
        html += '<details class="lt-ev-pastwrap"><summary>Recent past dates</summary><ul class="lt-ev-sched">' + past.map(scheduleRow).join("") + "</ul></details>";
      }
      upcoming.innerHTML = html;
    }
    if (countEl) { var n = eventsList().filter(function (e) { return !isPast(e); }).length; countEl.textContent = n ? (n + " upcoming") : ""; }

    // ----- Admin toolbar -----
    if (adminWrap) {
      adminWrap.innerHTML = "";
      if (who) {
        var bar = document.createElement("div"); bar.className = "lt-ev-bar";
        bar.innerHTML =
          '<strong>Manage schedule</strong>' +
          '<button type="button" class="lt-eb-btn lt-eb-primary" data-add="class">＋ Add class</button>' +
          '<button type="button" class="lt-eb-btn" data-add="retreat">＋ Add retreat</button>' +
          '<span class="lt-ev-status" data-ev-status></span>';
        bar.querySelector('[data-add="class"]').addEventListener("click", function () { openTemplatePicker("class"); });
        bar.querySelector('[data-add="retreat"]').addEventListener("click", function () { openTemplatePicker("retreat"); });
        adminWrap.appendChild(bar);
      }
    }

    injectJsonLd(events);
  }

  function scheduleRow(e) {
    return '<li class="lt-ev-row' + (isPast(e) ? " lt-ev-past" : "") + '" style="--c:' + esc(e.color || "var(--bronze-deep)") + '">' +
      '<span class="lt-ev-dot"></span>' +
      '<a href="#' + esc(e.id) + '" class="lt-ev-when">' + esc(fmtWhen(e)) + '</a>' +
      '<span class="lt-ev-title">' + esc(e.title) + (e.type === "retreat" ? ' · retreat' : "") + '</span>' +
      '<a class="lt-ev-go"' + signupAttrs(e) + ' href="' + esc(signupHref(e)) + '">' + (e.eventbriteUrl ? "Tickets " : "Sign up ") + esc(money(e.priceDollars || 0)) + '</a>' +
      '</li>';
  }

  function adminControls(e, i, events) {
    var wrap = document.createElement("div");
    wrap.className = "lt-ev-ctl";
    wrap.innerHTML =
      '<button type="button" data-act="edit">Edit</button>' +
      '<button type="button" data-act="dup">Duplicate</button>' +
      '<button type="button" data-act="up"' + (i === 0 ? " disabled" : "") + '>↑</button>' +
      '<button type="button" data-act="down"' + (i === events.length - 1 ? " disabled" : "") + '>↓</button>' +
      '<button type="button" data-act="del" class="lt-ev-del">Delete</button>';
    wrap.querySelector('[data-act="edit"]').addEventListener("click", function () { openEditor(e, i); });
    wrap.querySelector('[data-act="dup"]').addEventListener("click", function () {
      var copy = JSON.parse(JSON.stringify(e));
      copy.id = e.id + "-copy-" + Math.random().toString(36).slice(2, 6);
      copy.title = e.title + " (copy)";
      copy.eventbriteId = undefined;
      var next = events.slice(); next.splice(i + 1, 0, copy); saveEvents(next, "Duplicated.");
    });
    wrap.querySelector('[data-act="up"]').addEventListener("click", function () { move(events, i, -1); });
    wrap.querySelector('[data-act="down"]').addEventListener("click", function () { move(events, i, 1); });
    wrap.querySelector('[data-act="del"]').addEventListener("click", function () {
      if (!window.confirm("Delete “" + e.title + "”? This can be restored from History.")) return;
      var next = events.slice(); next.splice(i, 1); saveEvents(next, "Deleted.");
    });
    return wrap;
  }

  function move(events, i, delta) {
    var j = i + delta; if (j < 0 || j >= events.length) return;
    var next = events.slice(); var t = next[i]; next[i] = next[j]; next[j] = t;
    saveEvents(next, "Reordered.");
  }

  function status(msg) { var s = document.querySelector("[data-ev-status]"); if (s) s.textContent = msg || ""; }

  function saveEvents(next, okMsg) {
    var who = admin(); if (!who) return;
    status("Saving…");
    fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential: who.token, content: { events: next } }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok && res.d.ok) { content = res.d.content; render(); status("✅ Saved — live now."); }
        else { status((res.d && res.d.error) || "Couldn't save."); }
      }).catch(function () { status("Error saving. Please try again."); });
  }

  // ----- Modals (template picker + editor) -----
  function modal(title, bodyNode) {
    var m = document.createElement("div"); m.className = "lt-history lt-picker";
    var box = document.createElement("div"); box.className = "lt-history-box";
    var head = document.createElement("div"); head.className = "lt-history-head";
    head.innerHTML = "<strong>" + esc(title) + "</strong>";
    var close = document.createElement("button"); close.type = "button"; close.className = "lt-eb-link"; close.textContent = "Close";
    close.addEventListener("click", function () { m.remove(); });
    head.appendChild(close); box.appendChild(head); box.appendChild(bodyNode);
    m.appendChild(box); document.body.appendChild(m);
    m.addEventListener("click", function (e) { if (e.target === m) m.remove(); });
    return m;
  }

  function openTemplatePicker(type) {
    var body = document.createElement("div");
    body.innerHTML = '<p class="cal-note" style="margin:0 0 0.8rem">Pick a starting point — everything is editable afterwards.</p>';
    var g = document.createElement("div"); g.className = "lt-tpl-grid";
    TEMPLATES.filter(function (t) { return type === "retreat" ? t.type === "retreat" : true; }).forEach(function (t) {
      var b = document.createElement("button"); b.type = "button"; b.className = "lt-tpl-opt";
      b.innerHTML = '<img src="' + esc(t.image) + '" alt=""><span class="lt-tpl-name">' + esc(t.label) + '</span><span class="lt-tpl-type">' + (t.type === "retreat" ? "Retreat" : "Class") + '</span>';
      b.addEventListener("click", function () {
        m.remove();
        var e = {
          id: t.key + "-" + Math.random().toString(36).slice(2, 7),
          type: type || t.type, title: t.label, desc: t.desc, image: t.image,
          duration: t.duration, time: type === "retreat" ? "" : "6:00 PM", date: "",
          priceDollars: type === "retreat" ? 1295 : 40, color: "var(--bronze-deep)", waiver: type !== "retreat"
        };
        openEditor(e, -1);
      });
      g.appendChild(b);
    });
    body.appendChild(g);
    // also allow a blank one
    var blank = document.createElement("button"); blank.type = "button"; blank.className = "lt-eb-btn"; blank.style.marginTop = "0.8rem"; blank.textContent = "Start from blank";
    blank.addEventListener("click", function () {
      m.remove();
      openEditor({ id: "ev-" + Math.random().toString(36).slice(2, 7), type: type || "class", title: "", desc: "", image: "assets/hero-meadow.jpg", duration: type === "retreat" ? "Weekend · 2 nights" : "2 hours", time: type === "retreat" ? "" : "6:00 PM", date: "", priceDollars: type === "retreat" ? 1295 : 40, color: "var(--bronze-deep)", waiver: type !== "retreat" }, -1);
    });
    body.appendChild(blank);
    var m = modal("Add " + (type === "retreat" ? "a retreat" : "a class"), body);
  }

  function field(label, inner) { return '<label class="lt-ef"><span>' + esc(label) + '</span>' + inner + '</label>'; }

  function openEditor(ev, index) {
    var who = admin(); if (!who) return;
    var e = JSON.parse(JSON.stringify(ev));
    var body = document.createElement("div"); body.className = "lt-ev-form";
    body.innerHTML =
      field("Title", '<input type="text" data-f="title" value="' + esc(e.title) + '">') +
      field("Type", '<select data-f="type"><option value="class"' + (e.type !== "retreat" ? " selected" : "") + '>Class</option><option value="retreat"' + (e.type === "retreat" ? " selected" : "") + '>Retreat</option></select>') +
      '<div class="lt-ef-row">' +
        field("Date", '<input type="date" data-f="date" value="' + esc(e.date) + '">') +
        field("Time", '<input type="text" data-f="time" placeholder="6:00 PM" value="' + esc(e.time) + '">') +
      '</div>' +
      '<div class="lt-ef-row">' +
        field("Duration", '<input type="text" data-f="duration" value="' + esc(e.duration) + '">') +
        field("Price (USD)", '<input type="number" min="0" step="1" data-f="priceDollars" value="' + esc(e.priceDollars) + '">') +
      '</div>' +
      field("Location (optional)", '<input type="text" data-f="location" value="' + esc(e.location || "") + '">') +
      field("Description", '<textarea data-f="desc" rows="4">' + esc(e.desc) + '</textarea>') +
      field("Note (optional, italic line)", '<input type="text" data-f="note" value="' + esc(e.note || "") + '">') +
      '<div class="lt-ef-row">' +
        field("Accent colour", '<input type="text" data-f="color" placeholder="var(--bronze-deep) or #7a5f2c" value="' + esc(e.color || "") + '">') +
        field("Require waiver", '<select data-f="waiver"><option value="yes"' + (e.waiver !== false ? " selected" : "") + '>Yes</option><option value="no"' + (e.waiver === false ? " selected" : "") + '>No</option></select>') +
      '</div>' +
      '<div class="lt-ef-img"><span>Image</span><img data-f-img src="' + esc(e.image || "assets/hero-meadow.jpg") + '" alt=""><button type="button" class="lt-eb-btn" data-upload>Upload / replace…</button></div>' +
      '<div class="lt-ef-actions"><button type="button" class="lt-eb-btn lt-eb-primary" data-save>Save</button><span class="lt-ev-status" data-ef-status></span></div>';
    var m = modal(index < 0 ? "Add listing" : "Edit listing", body);

    // image upload
    var fileInput = document.createElement("input"); fileInput.type = "file"; fileInput.accept = "image/*"; fileInput.style.display = "none"; body.appendChild(fileInput);
    var efStatus = body.querySelector("[data-ef-status]");
    body.querySelector("[data-upload]").addEventListener("click", function () { fileInput.value = ""; fileInput.click(); });
    fileInput.addEventListener("change", function () {
      var f = fileInput.files && fileInput.files[0]; if (!f) return;
      if (f.size > 3 * 1024 * 1024) { efStatus.textContent = "Keep the image under 3 MB."; return; }
      efStatus.textContent = "Uploading…";
      var reader = new FileReader();
      reader.onload = function () {
        fetch("/api/admin-upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential: who.token, dataUrl: reader.result }) })
          .then(function (r) { return r.json(); }).then(function (d) {
            if (d.ok && d.url) { e.image = d.url; body.querySelector("[data-f-img]").src = d.url; efStatus.textContent = "Image ready."; }
            else { efStatus.textContent = d.error || "Upload failed."; }
          }).catch(function () { efStatus.textContent = "Upload failed."; });
      };
      reader.readAsDataURL(f);
    });

    body.querySelector("[data-save]").addEventListener("click", function () {
      function val(f) { var el = body.querySelector('[data-f="' + f + '"]'); return el ? el.value.trim() : ""; }
      e.title = val("title") || "Untitled";
      e.type = val("type") === "retreat" ? "retreat" : "class";
      e.date = val("date");
      e.time = val("time");
      e.duration = val("duration");
      e.priceDollars = parseFloat(val("priceDollars")) || 0;
      e.location = val("location");
      e.desc = val("desc");
      e.note = val("note");
      e.color = val("color") || "var(--bronze-deep)";
      e.waiver = val("waiver") !== "no";
      var events = eventsList().slice();
      if (index < 0 || index >= events.length) events.push(e); else events[index] = e;
      m.remove();
      saveEvents(events, "Saved.");
    });
  }

  function injectJsonLd(events) {
    try {
      var old = document.getElementById("lt-events-jsonld"); if (old) old.remove();
      var up = sorted(events).filter(function (e) { return !isPast(e) && e.date; });
      if (!up.length) return;
      var data = up.map(function (e) {
        var iso = e.date + "T" + to24h(e.time);
        return {
          "@context": "https://schema.org", "@type": "Event", name: e.title,
          description: (e.desc || "").slice(0, 300), startDate: iso,
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          eventStatus: "https://schema.org/EventScheduled",
          location: { "@type": "Place", name: e.location || "The Well — Integrative Medicine", address: { "@type": "PostalAddress", addressLocality: "Sacramento", addressRegion: "CA", addressCountry: "US" } },
          organizer: { "@type": "Organization", name: "Living Terrain", url: "https://livingterrain.org" },
          offers: { "@type": "Offer", price: String(e.priceDollars || 0), priceCurrency: "USD", availability: "https://schema.org/InStock", url: "https://livingterrain.org/classes.html#" + e.id }
        };
      });
      var s = document.createElement("script"); s.type = "application/ld+json"; s.id = "lt-events-jsonld";
      s.textContent = JSON.stringify(data);
      document.body.appendChild(s);
    } catch (e) {}
  }
  function to24h(t) {
    if (!t) return "18:00:00-07:00";
    var m = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(t);
    if (!m) return "18:00:00-07:00";
    var h = parseInt(m[1], 10), min = m[2], ap = (m[3] || "").toUpperCase();
    if (ap === "PM" && h < 12) h += 12; if (ap === "AM" && h === 12) h = 0;
    return (h < 10 ? "0" + h : h) + ":" + min + ":00-07:00";
  }

  // If content already loaded (edit module fetched it), render now; otherwise the
  // edit module calls window.LTEvents.apply(c) when it arrives.
  if (window.LT_CONTENT) apply(window.LT_CONTENT);

  // Graceful fallback: if content never arrives (API unreachable), don't leave the
  // page stuck on "Loading…".
  setTimeout(function () {
    if (content) return;
    var g = document.querySelector("[data-events-grid]");
    if (g && /Loading/.test(g.textContent)) g.innerHTML = '<p class="cal-note center" style="grid-column:1/-1">The schedule couldn\'t load just now — please refresh, or email <a href="mailto:info@livingterrain.org">info@livingterrain.org</a>.</p>';
    var u = document.querySelector("[data-events-upcoming]");
    if (u && /Loading/.test(u.textContent)) u.innerHTML = '<p class="cal-note">Schedule unavailable right now — please refresh.</p>';
  }, 7000);
})();
