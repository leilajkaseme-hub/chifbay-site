/* Chifbay motion layer, built on Motion (motion.dev, the engine behind
   Framer Motion, used here without React). The file is vendor/motion/.

   The effects are ports of the 21st.dev / Magic UI / Aceternity components,
   rewritten for plain HTML and tuned to the Marina look:
   1. BlurFade: blocks rise, unblur and fade in as they enter, siblings one
      after the other. It takes over the old .reveal / .rv transition.
   2. Photo settle: big photos start a little zoomed and settle to 1:1.
   3. NumberTicker: rating and boat figures count up once.
   4. Tilt card: media tiles and trip cards lean toward the pointer.
   5. Magnetic button: the main buttons follow the pointer a few pixels.

   Nothing here hides content for good: no Motion, reduced motion, or a
   headless capture (?once) and the page is exactly as before. */
(function () {
  "use strict";
  var M = window.Motion;
  if (!M || !M.animate || !M.inView) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (/[?&]once\b/.test(location.search)) return;

  var animate = M.animate, inView = M.inView, stagger = M.stagger;
  var html = document.documentElement;
  var EASE = [0.22, 0.65, 0.24, 1];
  var FINE = matchMedia("(hover: hover) and (pointer: fine)").matches;
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ------------------------------------------------------- 1. BlurFade */
  // Blur only on small blocks (titles, lines of text, buttons): blurring a
  // whole gallery costs frames for nothing you can see.
  var BLUR_MAX_H = 320;
  var items = $$(".reveal, .rv").filter(function (el) { return !el.closest(".hero, .bkhero"); });
  items.forEach(function (el) {
    el.setAttribute("data-mxr", "");
    el.style.opacity = "0";
    el.style.transform = "translateY(22px)";
    if (el.offsetHeight < BLUR_MAX_H) el.style.filter = "blur(8px)";
  });
  html.classList.add("mx");

  var queue = [], queued = false;
  function flush() {
    queued = false;
    var batch = queue.splice(0).sort(function (a, b) {
      return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    batch.forEach(function (el) { el.classList.add("in"); });
    animate(batch,
      { opacity: 1, transform: "translateY(0px)", filter: "blur(0px)" },
      { duration: 0.9, ease: EASE, delay: stagger(0.08) }
    ).then(function () {
      // Hand the element back to the stylesheet (.in = visible).
      batch.forEach(function (el) { el.style.opacity = el.style.transform = el.style.filter = ""; });
    });
  }
  items.forEach(function (el) {
    inView(el, function () {
      if (el._mx) return;
      el._mx = true;
      queue.push(el);
      if (!queued) { queued = true; requestAnimationFrame(flush); }
    }, { margin: "0px 0px -6% 0px", amount: 0.12 });
  });

  /* -------------------------------------------------- 2. Photo settle */
  var SKIP = ".hero, .t-card, .gal, .iggrid, .plat-band, .t-map, .t-route, .reserve, .bleed, header, footer";
  $$(".chapter img, .t-boat img, .minc video").forEach(function (img) {
    if (img.closest(SKIP)) return;
    var box = img.parentElement;
    if (!box || getComputedStyle(box).overflow === "visible") return;
    if (img.getBoundingClientRect().width < 240) return;
    img.style.transform = "scale(1.06)";
    inView(img, function () {
      if (img._mx) return;
      img._mx = true;
      animate(img, { transform: "scale(1)" }, { duration: 1.4, ease: EASE })
        .then(function () { img.style.transform = ""; });
    }, { amount: 0.1 });
  });

  /* ------------------------------------------------- 3. NumberTicker */
  $$(".proof b, .t-specs b, .t-hs b, [data-mx-count]").forEach(function (el) {
    var txt = el.textContent.trim();
    var m = /^(\D{0,2})(\d+(?:[.,]\d+)?)(\D{0,3})$/.exec(txt);
    if (!m) return;
    var sep = m[2].indexOf(",") > -1 ? "," : ".";
    var target = parseFloat(m[2].replace(",", "."));
    var dec = (m[2].split(/[.,]/)[1] || "").length;
    if (!(target > 0)) return;
    el.style.fontVariantNumeric = "tabular-nums";
    el.textContent = m[1] + (0).toFixed(dec).replace(".", sep) + m[3];
    inView(el, function () {
      if (el._mx) return;
      el._mx = true;
      animate(0, target, {
        duration: 1.6, ease: [0.16, 1, 0.3, 1],
        onUpdate: function (v) { el.textContent = m[1] + v.toFixed(dec).replace(".", sep) + m[3]; }
      }).then(function () { el.textContent = txt; });
    }, { amount: 0.6 });
  });

  if (!FINE) return; // the rest follows a mouse

  /* ------------------------------------------------------ 4. Tilt card */
  var MAX_TILT = 4; // degrees
  $$(".minc .mi, .t-card, .atlas .iggrid a").forEach(function (card) {
    card.setAttribute("data-mx-tilt", "");
    var ctl = null;
    function busy() { return card.style.opacity !== ""; } // still revealing
    card.addEventListener("pointermove", function (e) {
      if (busy()) return;
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      if (ctl) ctl.stop();
      ctl = animate(card, {
        transform: "perspective(1000px) rotateX(" + (-py * MAX_TILT).toFixed(2) + "deg) rotateY(" +
          (px * MAX_TILT).toFixed(2) + "deg) translateY(-4px)"
      }, { duration: 0.35, ease: "easeOut" });
    });
    card.addEventListener("pointerleave", function () {
      if (busy()) return;
      if (ctl) ctl.stop();
      ctl = animate(card, { transform: "perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)" },
        { type: "spring", stiffness: 260, damping: 22 });
      ctl.then(function () { card.style.transform = ""; });
    });
  });

  /* -------------------------------------------------- 5. Magnetic button */
  var PULL = 0.18, MAX_PULL = 7; // share of the distance, cap in px
  $$(".hero .hact .btn, .reserve .btn, .t-card-cta .btn-p, #nav .nc").forEach(function (btn) {
    var ctl = null;
    btn.addEventListener("pointermove", function (e) {
      var r = btn.getBoundingClientRect();
      var dx = Math.max(-MAX_PULL, Math.min(MAX_PULL, (e.clientX - r.left - r.width / 2) * PULL));
      var dy = Math.max(-MAX_PULL, Math.min(MAX_PULL, (e.clientY - r.top - r.height / 2) * PULL));
      if (ctl) ctl.stop();
      ctl = animate(btn, { transform: "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px)" },
        { duration: 0.25, ease: "easeOut" });
    });
    btn.addEventListener("pointerleave", function () {
      if (ctl) ctl.stop();
      ctl = animate(btn, { transform: "translate(0px,0px)" }, { type: "spring", stiffness: 320, damping: 18 });
      ctl.then(function () { btn.style.transform = ""; });
    });
  });
})();
