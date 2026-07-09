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

  function readCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch (e) { return []; }
  }
  function writeCart(items) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (e) {}
    updateCartBadges();
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
  document.querySelectorAll("[data-buy-now]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (qtyInCart(btn.getAttribute("data-id")) === 0) addToCart(itemFrom(btn));
      window.location.href = "cart.html";
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
    var isRetreat = type === "retreat";

    // Note: the eyebrow and <h1> live in the page-hero, outside [data-signup],
    // so these resolve against the whole document, not the signup container.
    setText("[data-su-eyebrow]", isRetreat ? "Retreat sign-up" : "Class sign-up");
    setText("[data-su-item]", item);
    setText("[data-su-label]", isRetreat ? "Retreat" : "Class", signup);
    setText("[data-su-name]", item, signup);
    var whenRow = signup.querySelector("[data-su-when-row]");
    if (when) setText("[data-su-when]", when, signup);
    else if (whenRow) whenRow.hidden = true;
    setText("[data-su-price]", price ? "$" + price : "Free", signup);

    var suForm = signup.querySelector("#signup-form");
    var suView = signup.querySelector("[data-signup-view]");
    var suConfirm = signup.querySelector("[data-confirm]");

    var completeSignup = function (skipped) {
      var name = (suForm.querySelector('[name="name"]').value || "").trim();
      var email = (suForm.querySelector('[name="email"]').value || "").trim();
      if (!name || !email || !emailOk(email)) { suForm.reportValidity(); return; }
      var phone = (suForm.querySelector('[name="phone"]').value || "").trim();
      var subject = (isRetreat ? "Retreat sign-up" : "Class sign-up") + ": " + item;
      var message = "Sign-up for: " + item + (when ? " (" + when + ")" : "") +
        (price ? " — $" + price : "") +
        "\nPhone: " + (phone || "—") +
        "\nPayment: " + (skipped ? "skipped (pay later)" : "demo — collected on site");
      var msgEl = suConfirm.querySelector("[data-confirm-msg]");
      msgEl.textContent = "Thank you, " + name + " — you're signed up for " + item + ". Sending your confirmation email…";
      suView.hidden = true;
      suConfirm.hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
      sendContact({
        subject: subject, name: name, email: email, message: message,
        confirm: true, kind: (isRetreat ? "retreat" : "class"), item: item
      }).then(function (res) {
        msgEl.textContent = "Thank you, " + name + " — you're signed up for " + item + ". " +
          (res.confirmSent
            ? "A confirmation email is on its way to " + email + "."
            : "We've noted your sign-up and will follow up at " + email + " shortly.");
      });
    };
    suForm.addEventListener("submit", function (e) { e.preventDefault(); completeSignup(false); });
    var suSkip = signup.querySelector("[data-skip-pay]");
    if (suSkip) suSkip.addEventListener("click", function () { completeSignup(true); });
  }

  /* ---------- Cart + checkout page ---------- */
  var cartView = document.querySelector("[data-cart-view]");
  var checkoutView = document.querySelector("[data-checkout-view]");
  if (cartView && checkoutView) {
    var itemsWrap = document.querySelector("[data-cart-items]");
    var emptyMsg = document.querySelector("[data-cart-empty]");
    var totalRow = document.querySelector("[data-cart-total-row]");
    var totalEl = document.querySelector("[data-cart-total]");
    var actions = document.querySelector("[data-cart-actions]");
    var coConfirm = document.querySelector("[data-confirm]");
    var coForm = document.querySelector("#checkout-form");
    var coLines = document.querySelector("[data-checkout-lines]");
    var coTotal = document.querySelector("[data-checkout-total]");

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
    renderCart();

    var renderSummary = function () {
      var items = readCart();
      coLines.innerHTML = "";
      items.forEach(function (it) {
        var r = document.createElement("div");
        r.className = "os-row";
        r.innerHTML = "<span>" + esc(it.name) + " × " + it.qty + "</span><span>$" + (it.qty * it.price) + "</span>";
        coLines.appendChild(r);
      });
      coTotal.textContent = "$" + cartTotal(items);
    };

    var gotoCheckout = document.querySelector("[data-goto-checkout]");
    if (gotoCheckout) gotoCheckout.addEventListener("click", function () {
      if (!readCart().length) return;
      renderSummary();
      cartView.hidden = true; checkoutView.hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    var backToCart = document.querySelector("[data-back-to-cart]");
    if (backToCart) backToCart.addEventListener("click", function () {
      checkoutView.hidden = true; cartView.hidden = false; renderCart();
    });

    var placeOrder = function (skipped) {
      var name = (coForm.querySelector('[name="name"]').value || "").trim();
      var email = (coForm.querySelector('[name="email"]').value || "").trim();
      if (!name || !email || !emailOk(email)) { coForm.reportValidity(); return; }
      var items = readCart();
      var summary = items.map(function (it) {
        return it.name + " × " + it.qty + " ($" + (it.qty * it.price) + ")";
      }).join("\n");
      var msg = "Order:\n" + summary + "\nTotal: $" + cartTotal(items) +
        "\nAddress: " + (coForm.querySelector('[name="address"]').value || "—") +
        "\nPayment: " + (skipped ? "skipped (pay later)" : "demo — collected on site");
      var msgEl = coConfirm.querySelector("[data-confirm-msg]");
      msgEl.textContent = "Thank you, " + name + " — your order is confirmed. Sending your receipt…";
      writeCart([]);
      cartView.hidden = true; checkoutView.hidden = true;
      coConfirm.hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
      sendContact({
        subject: "Extract order", name: name, email: email, message: msg,
        confirm: true, kind: "order", item: "your Living Terrain order"
      }).then(function (res) {
        msgEl.textContent = "Thank you, " + name + " — your order is confirmed. " +
          (res.confirmSent
            ? "A confirmation email is on its way to " + email + "."
            : "We've received your order and will email your confirmation to " + email + " shortly.");
      });
    };
    coForm.addEventListener("submit", function (e) { e.preventDefault(); placeOrder(false); });
    var coSkip = checkoutView.querySelector("[data-skip-pay]");
    if (coSkip) coSkip.addEventListener("click", function () { placeOrder(true); });
  }
})();
