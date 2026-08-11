/* Chifbay — homepage "Guest voices", kept live.
   Fetches the same reviews.json the reviews-auto pipeline writes, so this
   section never goes stale when a new GetYourGuide/Google/Tripadvisor review
   lands.

   The 3 static <figure> cards already in the HTML are left in place as a
   no-JS / pre-fetch fallback and are only swapped once real data arrives.
   When it does, the grid becomes a rail carrying EVERY verified review,
   newest first.

   It STEPS rather than drifts (changed 2026-08-11): it holds still for 5
   seconds so a quote can be read, then slides one card left. A continuous
   marquee looked alive but nothing on it could actually be read.

   The loop is seamless because the whole set is cloned once onto the end of
   the same track. When the step index reaches the end of the originals the
   view is already showing clone #0, which is pixel-identical to original #0,
   so the jump back to 0 with the transition switched off is invisible. */
(function () {
  var wrap = document.getElementById("revsLive");
  var countEl = document.getElementById("revsCount");
  if (!wrap) return;


  function esc(s) {
    return (s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function stars(n) {
    n = Math.max(0, Math.min(5, Math.round(n || 5)));
    return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
  }
  // The localized pages carry their own wording on #revsLive, so the live
  // cards read in the page's language instead of falling back to English
  // the moment reviews.json loads.
  var VERIFIED = wrap.getAttribute("data-verified") || "Verified";
  var REVIEWS_WORD = wrap.getAttribute("data-reviews-word") || "reviews";
  var AVG_TEXT = wrap.getAttribute("data-average") || "★ average across {n} verified reviews";

  function sourceLabel(s) {
    var platform = s === "google" ? "Google"
      : s === "tripadvisor" ? "Tripadvisor"
      : "GetYourGuide";
    return VERIFIED + " · " + platform;
  }
  // Newest first. Reviews without a usable date sink to the bottom rather than
  // jumping to the top, which is what Date("") would do.
  function byDateDesc(a, b) {
    var da = Date.parse(a.date || "") || 0, db = Date.parse(b.date || "") || 0;
    return db - da;
  }

  function card(r, i, isClone) {
    return '<figure class="rev reveal in src-' + esc(r.source || "") + '"' +
      (isClone ? ' aria-hidden="true"' : ' role="listitem"') +
      ' data-rv="' + i + '">' +
      '<div class="st">' + stars(r.rating) + "</div>" +
      "<q>" + esc(r.text.length > 260 ? r.text.slice(0, 257) + "…" : r.text) + "</q>" +
      '<figcaption><div class="who">' + esc(r.author) + "</div>" +
      '<div class="src">' + sourceLabel(r.source) + "</div></figcaption>" +
      "</figure>";
  }

  /* Drives the rail: one step every DWELL ms, pausing while a visitor is
     reading it, while the tab is in the background, and entirely when the
     visitor has asked for reduced motion. */
  function ride(root, count) {
    var DWELL = 5000;
    var track = root.querySelector(".rv-track");
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!track || (reduce && reduce.matches)) return;

    var i = 0, timer = null, held = false;

    // measured, not recomputed from the CSS formula — one source of truth
    function stepPx() {
      var c = track.firstElementChild;
      if (!c) return 0;
      var gap = parseFloat(getComputedStyle(track).columnGap || 0) || 0;
      return c.getBoundingClientRect().width + gap;
    }
    function paint() {
      // +1 because child 0 is the lead clone sitting in the left peek
      track.style.transform = "translateX(" + (-(i + 1) * stepPx()) + "px)";
      var n = Math.max(1, Math.round(parseFloat(getComputedStyle(root).getPropertyValue("--rvn")) || 1));
      Array.prototype.forEach.call(track.children, function (el, idx) {
        // everything outside the n cards on screen is a neighbour, and dimmed
        if (idx >= i + 1 && idx < i + 1 + n) el.removeAttribute("data-rv-side");
        else el.setAttribute("data-rv-side", "");
      });
    }
    function go(next) { i = next; paint(); }

    // the snap back to the top of the loop, with the transition switched off
    track.addEventListener("transitionend", function (e) {
      if (e.propertyName !== "transform" || i < count) return;
      track.classList.add("rv-jump");
      i = 0;
      paint();
      void track.offsetHeight;          // force the reflow before re-enabling
      track.classList.remove("rv-jump");
    });

    function start() { if (!timer && !held) timer = setInterval(function () { go(i + 1); }, DWELL); }
    function stop() { clearInterval(timer); timer = null; }
    function hold(on) { held = on; if (on) stop(); else start(); }

    // let people read: hovering, focusing or touching it holds the rail
    root.addEventListener("mouseenter", function () { hold(true); });
    root.addEventListener("mouseleave", function () { hold(false); });
    root.addEventListener("focusin", function () { hold(true); });
    root.addEventListener("focusout", function () { hold(false); });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else start();
    });

    /* Drag / swipe. 34 reviews is far too many for a row of dots, and without
       a handle a visitor who wants the card that just left has to sit through
       the whole rail. Dragging is what people reach for anyway. */
    var down = null;
    track.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      down = { x: e.clientX, at: i, moved: 0 };
      hold(true);
      track.classList.add("rv-jump");           // follow the finger exactly
    });
    track.addEventListener("pointermove", function (e) {
      if (!down) return;
      down.moved = e.clientX - down.x;
      track.style.transform =
        "translateX(" + (-(down.at + 1) * stepPx() + down.moved) + "px)";
    });
    function release() {
      if (!down) return;
      track.classList.remove("rv-jump");
      var by = Math.round(-down.moved / stepPx());
      // a short flick still counts as one card
      if (!by && Math.abs(down.moved) > 40) by = down.moved < 0 ? 1 : -1;
      var next = down.at + by;
      // the loop only clones forward, so going back past the start wraps by
      // jumping to the matching card near the end with no transition
      if (next < 0) {
        track.classList.add("rv-jump");
        i = next + count; paint(); void track.offsetHeight;
        track.classList.remove("rv-jump");
      } else {
        go(Math.min(next, count - 1));
      }
      var was = down; down = null;
      setTimeout(function () { hold(false); }, 0);
      return was;
    }
    track.addEventListener("pointerup", release);
    track.addEventListener("pointercancel", release);
    track.addEventListener("pointerleave", release);
    // a drag must not also fire whatever it happened to end on
    track.addEventListener("click", function (e) {
      if (down && Math.abs(down.moved) > 6) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    // the card width is a container query, so it changes on resize
    var rz;
    window.addEventListener("resize", function () {
      clearTimeout(rz);
      rz = setTimeout(function () {
        track.classList.add("rv-jump");
        paint();
        void track.offsetHeight;
        track.classList.remove("rv-jump");
      }, 150);
    });

    // first paint after layout has settled, or the width measures as 0
    requestAnimationFrame(function () { requestAnimationFrame(function () { paint(); start(); }); });
  }

  fetch("/reviews.json", { cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var reviews = (data.reviews || []).filter(function (r) { return r.text && r.text.length > 8; });
      if (!reviews.length) return;
      // every review: the rail is meant to be long, and the pipeline keeps adding.
      var top = reviews.slice().sort(byDateDesc);

      // "reveal in" (not just "reveal") — the IntersectionObserver that adds
      // .in already ran on page load and won't see elements inserted later,
      // which would otherwise leave these permanently at opacity:0.
      var cards = top.map(function (r, i) { return card(r, i, false); }).join("");

      // The clones are hidden from assistive tech, otherwise every quote
      // would be announced twice.
      // A copy of the LAST review is also parked at the head of the track, so
      // that even at position 0 there is a card peeking in from the left.
      // Without it the rail starts with an empty gap down its left edge.
      var lead = card(top[top.length - 1], top.length - 1, true);
      var clones = top.map(function (r, i) { return card(r, i, true); }).join("");
      var label = esc(wrap.getAttribute("data-rail-label") || "Guest reviews");
      wrap.className = "revs marquee";
      wrap.innerHTML =
        '<div class="rv-mq">' +
          '<div class="rv-track" role="list" aria-label="' + label + '">' +
            lead + cards + clones +
          "</div>" +
        "</div>";

      ride(wrap, top.length);

      if (countEl && data.aggregate) {
        countEl.textContent = data.aggregate.rating.toFixed(1) +
          AVG_TEXT.replace("{n}", data.aggregate.count);
      }

    })
    .catch(function () { /* keep the static fallback cards already in the HTML */ });

})();
