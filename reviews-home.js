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

  var LANG = (document.documentElement.lang || "en").slice(0, 2);
  var READ_ON = wrap.getAttribute("data-read-on") || "Read on {p}";
  var MORE = wrap.getAttribute("data-more") || "Read more";
  var LESS = wrap.getAttribute("data-less") || "Show less";
  // the original of each review: the place page on Google, the trip page on
  // GetYourGuide, our listing on Tripadvisor (its reviews carry no own link)
  var TA_URL = "https://www.tripadvisor.com/Attraction_Review-g189167-d34387047.html";
  function platform(s) {
    return s === "google" ? "Google" : s === "tripadvisor" ? "Tripadvisor" : "GetYourGuide";
  }
  function original(r) {
    if (r.source === "tripadvisor") return TA_URL;
    return /^https:\/\//.test(r.tourUrl || "") ? r.tourUrl : "";
  }
  function when(d) {
    var t = Date.parse(d || "");
    if (!t) return "";
    try { return new Date(t).toLocaleDateString(LANG, { month: "short", year: "numeric" }); }
    catch (e) { return d.slice(0, 7); }
  }
  // Newest first. Reviews without a usable date sink to the bottom rather than
  // jumping to the top, which is what Date("") would do.
  function byDateDesc(a, b) {
    var da = Date.parse(a.date || "") || 0, db = Date.parse(b.date || "") || 0;
    return db - da;
  }

  /* One card design for every platform (2 Oct 2026 audit): the platform is a
     small badge, not a coloured frame. Date, rating, the full text (clamped,
     with Read more) and a link to the original review. */
  function card(r, i, isClone) {
    var n = Math.max(0, Math.min(5, Math.round(+r.rating || 5)));
    var url = original(r), src = esc(r.source || "getyourguide"), p = platform(r.source);
    return '<figure class="rev reveal in src-' + src + '"' +
      (isClone ? ' aria-hidden="true" inert' : ' role="listitem"') + ' data-rv="' + i + '">' +
      '<div class="rv-top"><span class="st" role="img" aria-label="' + n + '/5">' + stars(n) + "</span>" +
      '<span class="rv-badge rv-b-' + src + '">' + p + "</span></div>" +
      "<q>" + esc(r.text) + "</q>" +
      '<button type="button" class="rv-more" hidden>' + esc(MORE) + "</button>" +
      '<figcaption><div class="who">' + esc(r.author) + "</div>" +
      '<div class="src">' + esc(VERIFIED) + (when(r.date) ? " · " + esc(when(r.date)) : "") + "</div>" +
      (url ? '<a class="rv-orig" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(READ_ON.replace("{p}", p)) + " ↗</a>" : "") +
      "</figcaption></figure>";
  }
  // Read more only where the clamp actually cuts the text
  function moreButtons(root) {
    Array.prototype.forEach.call(root.querySelectorAll(".rev:not([aria-hidden]) .rv-more"), function (b) {
      var q = b.previousElementSibling;
      b.hidden = !(q && q.scrollHeight > q.clientHeight + 2) && !b.parentNode.classList.contains("open");
    });
  }

  /* Drives the rail: one step every DWELL ms, pausing while a visitor is
     reading it, while the tab is in the background, and entirely when the
     visitor has asked for reduced motion. */
  function ride(root, count) {
    var DWELL = 5000;
    var track = root.querySelector(".rv-track");
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!track || (reduce && reduce.matches)) return;

    var i = 0, timer = null, held = false, paused = false;

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

    function start() { if (!timer && !held && !paused) timer = setInterval(function () { go(i + 1); }, DWELL); }
    function stop() { clearInterval(timer); timer = null; }
    function hold(on) { held = on; if (on) stop(); else start(); }

    // Previous / Pause / Next: the rail never moves without a way to stop it
    var ctl = root.querySelector(".rv-ctl");
    if (ctl) {
      var pp = ctl.querySelector(".rv-pp");
      var PAUSE = pp.getAttribute("data-pause"), PLAY = pp.getAttribute("data-play");
      function setPP() {
        pp.setAttribute("aria-pressed", paused ? "true" : "false");
        pp.setAttribute("aria-label", paused ? PLAY : PAUSE);
        pp.innerHTML = paused ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z"/></svg>'
          : '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3h3v10H4zM9 3h3v10H9z"/></svg>';
      }
      pp.addEventListener("click", function () { paused = !paused; setPP(); if (paused) stop(); else start(); });
      ctl.querySelector(".rv-prev").addEventListener("click", function () { stop(); step(-1); start(); });
      ctl.querySelector(".rv-next").addEventListener("click", function () { stop(); step(1); start(); });
      setPP();
    }
    function step(by) {
      var next = i + by;
      if (next < 0) {
        track.classList.add("rv-jump");
        i = count; paint(); void track.offsetHeight;
        track.classList.remove("rv-jump");
        next = count - 1;
      }
      go(next);
    }
    root.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest(".rv-more");
      if (!b) return;
      var f = b.parentNode, open = f.classList.toggle("open");
      b.textContent = open ? LESS : MORE;
      b.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) { paused = true; stop(); if (ctl) setPPext(); }
    });
    function setPPext() { var pp = ctl.querySelector(".rv-pp"); pp.setAttribute("aria-pressed", "true"); pp.setAttribute("aria-label", pp.getAttribute("data-play"));
      pp.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z"/></svg>'; }

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
        moreButtons(root);
      }, 150);
    });

    // first paint after layout has settled, or the width measures as 0
    requestAnimationFrame(function () { requestAnimationFrame(function () { paint(); moreButtons(root); start(); }); });
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
        "</div>" +
        '<div class="rv-ctl">' +
          '<button type="button" class="rv-prev" aria-label="' + esc(wrap.getAttribute("data-prev") || "Previous reviews") + '"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg></button>' +
          '<button type="button" class="rv-pp" data-pause="' + esc(wrap.getAttribute("data-pause") || "Pause reviews") + '" data-play="' + esc(wrap.getAttribute("data-play") || "Play reviews") + '"></button>' +
          '<button type="button" class="rv-next" aria-label="' + esc(wrap.getAttribute("data-next") || "Next reviews") + '"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg></button>' +
        "</div>";

      ride(wrap, top.length);

      if (countEl && data.aggregate) {
        countEl.textContent = data.aggregate.rating.toFixed(1) +
          AVG_TEXT.replace("{n}", data.aggregate.count);
      }

    })
    .catch(function () { /* keep the static fallback cards already in the HTML */ });

})();
