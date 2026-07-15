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
    var FONTS = [
      { label: "Default", value: "" },
      { label: "Serif display", value: '"Cormorant Garamond", Georgia, serif' },
      { label: "Serif body", value: '"EB Garamond", Georgia, serif' },
      { label: "Sans (labels)", value: '"Jost", system-ui, sans-serif' },
      { label: "Classic serif", value: "Georgia, 'Times New Roman', serif" },
      { label: "Clean sans", value: "Arial, Helvetica, sans-serif" }
    ];
    function textNodes() {
      var sel = "#main h1,#main h2,#main h3,#main h4,#main p,#main li,#main .lede,#main .tagline,#main .eyebrow,#main figcaption";
      return Array.prototype.slice.call(document.querySelectorAll(sel)).filter(function (el) {
        return el.children.length === 0 && el.textContent.trim().length > 0 &&
          !el.hasAttribute("data-edit") && !el.closest(".lt-editbar") && !el.closest(".lt-history");
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
        if (t.text != null) el.textContent = t.text;
        if (t.color) el.style.color = t.color;
        if (t.font) el.style.fontFamily = t.font;
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
      if (c.texts) applyTexts(c.texts);
      if (c.images) applyImages(c.images);
    }

    fetch("/api/content").then(function (r) { return r.json(); })
      .then(function (c) { if (c && typeof c.bottleCents === "number") apply(c); initEdit(); })
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
        '<select class="lt-eb-font" data-eb-font hidden aria-label="Font"></select>' +
        '<button type="button" class="lt-eb-btn" data-eb-history>History</button>' +
        '<span class="lt-eb-status" data-eb-status></span>' +
        '<button type="button" class="lt-eb-link" data-eb-signout>Sign out</button>';
      document.body.appendChild(bar);

      // ----- Change log + revert -----
      var histWrap = document.createElement("div");
      histWrap.className = "lt-history"; histWrap.hidden = true;
      histWrap.innerHTML = '<div class="lt-history-box"><div class="lt-history-head"><strong>Change history</strong><button type="button" class="lt-eb-link" data-hist-close>Close</button></div><div class="lt-history-list" data-hist-list>Loading…</div></div>';
      document.body.appendChild(histWrap);
      function fmtSnap(s) {
        var when = s.updatedAt ? new Date(s.updatedAt).toLocaleString() : "—";
        var by = s.updatedBy || "—";
        var summary = "bottle $" + (s.bottleCents / 100) + " · collection $" + (s.collectionCents / 100) + " · class $" + (s.classPriceCents / 100);
        return { when: when, by: by, summary: summary };
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
              var f = fmtSnap(s);
              var row = document.createElement("div"); row.className = "lt-history-row";
              row.innerHTML = '<div><div class="lt-h-when">' + f.when + (i === 0 ? " · current" : "") + '</div><div class="lt-h-sum">' + f.summary + ' — <em>' + f.by + '</em></div></div>';
              if (i !== 0 && who.role === "superadmin") {
                var b = document.createElement("button"); b.type = "button"; b.className = "lt-eb-btn"; b.textContent = "Revert to this";
                b.addEventListener("click", function () {
                  if (!window.confirm("Revert the site to this version?")) return;
                  b.textContent = "Reverting…";
                  fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential: who.token, action: "revert", ts: s.updatedAt }) })
                    .then(function (r) { return r.json(); }).then(function (res) {
                      if (res.ok && res.content) { apply(res.content); histWrap.hidden = true; st.textContent = "✅ Reverted — live now."; }
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
      FONTS.forEach(function (f) { var o = document.createElement("option"); o.value = f.value; o.textContent = f.label; fontCtl.appendChild(o); });

      // ----- Click-in-place TEXT editing (+ colour & font) -----
      var tNodes = textNodes();
      var activeText = null;
      function rgbToHex(rgb) { var m = (rgb || "").match(/\d+/g); if (!m || m.length < 3) return null; return "#" + m.slice(0, 3).map(function (x) { var h = parseInt(x, 10).toString(16); return h.length < 2 ? "0" + h : h; }).join(""); }
      function stageText(el) {
        var i = tNodes.indexOf(el); if (i < 0) return;
        var key = PID + "#t" + i;
        pending.texts = pending.texts || {};
        var entry = pending.texts[key] || {};
        entry.orig = el.dataset.ltOrig;
        entry.text = el.textContent;
        if (el.style.color) entry.color = el.style.color;
        if (el.style.fontFamily) entry.font = el.style.fontFamily;
        pending.texts[key] = entry;
        st.textContent = "Edited — click Publish to make it live.";
      }
      tNodes.forEach(function (el) {
        el.addEventListener("click", function () {
          if (!editing) return;
          if (el.dataset.ltOrig == null) el.dataset.ltOrig = el.textContent;
          activeText = el;
          el.setAttribute("contenteditable", "true");
          el.focus();
          try { colorCtl.value = rgbToHex(getComputedStyle(el).color) || "#33342c"; } catch (e) {}
          fontCtl.value = el.style.fontFamily || "";
        });
        el.addEventListener("input", function () { if (editing) stageText(el); });
        el.addEventListener("blur", function () { el.removeAttribute("contenteditable"); });
      });
      colorCtl.addEventListener("input", function () { if (activeText) { activeText.style.color = colorCtl.value; stageText(activeText); } });
      fontCtl.addEventListener("change", function () { if (activeText) { activeText.style.fontFamily = fontCtl.value; stageText(activeText); } });

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

      toggle.addEventListener("click", function () {
        editing = !editing;
        document.body.classList.toggle("lt-editing", editing);
        toggle.textContent = "✎ Edit mode: " + (editing ? "on" : "off");
        pub.hidden = !editing;
        colorCtl.hidden = !editing; fontCtl.hidden = !editing;
        tNodes.forEach(function (el) { el.classList.toggle("lt-tedit", editing); if (!editing) el.removeAttribute("contenteditable"); });
        imgEls.forEach(function (o) { o.el.classList.toggle("lt-iedit", editing); });
        st.textContent = editing ? "Click any highlighted text, price, time, or image to change it." : "";
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
            else { st.textContent = (res.d.error || "Couldn't publish.") + (/authorized/i.test(res.d.error || "") ? " Please sign in again at /admin.html." : ""); }
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
          if (suStatus) { suStatus.style.color = "#8f5836"; suStatus.textContent = "Please agree to the liability waiver to sign up for a class."; }
          wi.focus();
          return;
        }
        waiverAgreed = "agreed";
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
