/* Chifbay — homepage "Guest voices", kept live.
   Fetches the same reviews.json the reviews-auto pipeline writes, so this
   section never goes stale when a new GetYourGuide/Google/Tripadvisor review
   lands.

   The 3 static <figure> cards already in the HTML are left in place as a
   no-JS / pre-fetch fallback and are only swapped once real data arrives.
   When it does, the grid becomes a horizontal slider showing the most recent
   reviews instead of three fixed ones (changed 2026-08-10).

   The slider is a scroll-snap rail, not a transform carousel: swipe, trackpad,
   arrow keys and the browser's own focus scrolling all work for free, and if
   the JS below ever throws, the cards are still readable. */
(function () {
  var wrap = document.getElementById("revsLive");
  var countEl = document.getElementById("revsCount");
  if (!wrap) return;

  var MAX = 12; // enough to feel deep, not so many the rail never ends

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

  fetch("/reviews.json", { cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var reviews = (data.reviews || []).filter(function (r) { return r.text && r.text.length > 8; });
      if (!reviews.length) return;
      var top = reviews.slice().sort(byDateDesc).slice(0, MAX);

      // "reveal in" (not just "reveal") — the IntersectionObserver that adds
      // .in already ran on page load and won't see elements inserted later,
      // which would otherwise leave these permanently at opacity:0.
      var cards = top.map(function (r) {
        return '<figure class="rev reveal in src-' + esc(r.source || "") + '">' +
          '<div class="st">' + stars(r.rating) + "</div>" +
          "<q>" + esc(r.text.length > 260 ? r.text.slice(0, 257) + "…" : r.text) + "</q>" +
          '<figcaption><div class="who">' + esc(r.author) + "</div>" +
          '<div class="src">' + sourceLabel(r.source) + "</div></figcaption>" +
          "</figure>";
      }).join("");

      wrap.className = "revs slider";
      wrap.innerHTML = '<div class="rv-track" id="rvTrack" tabindex="0" role="group" ' +
        'aria-label="' + esc(wrap.getAttribute("data-rail-label") || "Guest reviews, scrollable") +
        '">' + cards + "</div>";

      if (countEl && data.aggregate) {
        countEl.textContent = data.aggregate.rating.toFixed(1) +
          AVG_TEXT.replace("{n}", data.aggregate.count);
      }

      buildNav(wrap, top.length);
    })
    .catch(function () { /* keep the static fallback cards already in the HTML */ });

  /* ------------------------------------------------------------------ nav */

  function buildNav(wrap, total) {
    var track = wrap.querySelector(".rv-track");
    if (!track) return;

    /* Moving the rail.
       Three things can stop a scroll from happening, and all three were seen
       while building this: CSS `scroll-behavior:smooth` on the rail made every
       programmatic scroll a no-op, `behavior:"smooth"` passed per call did the
       same, and a rAF tween never ran because the frame loop was starved. A
       plain `scrollLeft =` assignment always worked.

       So: ask for the nice animated scroll, then check a moment later that we
       actually moved. If we did not, jump. The control is never dead. */
    var REDUCE = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function glideTo(to) {
      to = Math.max(0, Math.min(to, track.scrollWidth - track.clientWidth));
      var from = track.scrollLeft;
      if (Math.abs(to - from) < 2) return;

      if (REDUCE) { track.scrollLeft = to; renderDots(); return; }

      try { track.scrollTo({ left: to, behavior: "smooth" }); }
      catch (e) { track.scrollLeft = to; }

      setTimeout(function () {
        // Nothing moved -> the browser ignored us. Land on the target now.
        if (Math.abs(track.scrollLeft - from) < 2) track.scrollLeft = to;
        renderDots();
      }, 140);
    }

    var nav = document.createElement("div");
    nav.className = "rv-nav";
    nav.innerHTML =
      '<button type="button" class="rv-btn" data-dir="-1" aria-label="' + esc(wrap.getAttribute('data-prev') || 'Previous reviews') + '">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>' +
      '<button type="button" class="rv-btn" data-dir="1" aria-label="' + esc(wrap.getAttribute('data-next') || 'Next reviews') + '">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>' +
      '<div class="rv-dots" id="rvDots"></div>' +
      '<div class="rv-count">' + total + " " + REVIEWS_WORD + "</div>";
    wrap.insertAdjacentElement("afterend", nav);

    var dotsWrap = nav.querySelector("#rvDots");
    var btns = nav.querySelectorAll(".rv-btn");

    // How many cards fit right now — the CSS shows 3 / 2 / 1 depending on width,
    // so page size is measured rather than hard-coded.
    function perView() {
      var card = track.firstElementChild;
      if (!card) return 1;
      var step = card.getBoundingClientRect().width + 20; // + gap
      return Math.max(1, Math.round(track.clientWidth / step));
    }
    function pageCount() { return Math.max(1, Math.ceil(total / perView())); }
    function currentPage() {
      var card = track.firstElementChild;
      if (!card) return 0;
      var step = (card.getBoundingClientRect().width + 20) * perView();
      return Math.min(pageCount() - 1, Math.round(track.scrollLeft / step));
    }

    function renderDots() {
      var n = pageCount();
      if (dotsWrap.childElementCount !== n) {
        dotsWrap.innerHTML = "";
        for (var i = 0; i < n; i++) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "rv-dot";
          b.dataset.page = i;
          b.setAttribute("aria-label", "Reviews page " + (i + 1) + " of " + n);
          dotsWrap.appendChild(b);
        }
      }
      var cur = currentPage();
      Array.prototype.forEach.call(dotsWrap.children, function (d, i) {
        d.setAttribute("aria-current", i === cur ? "true" : "false");
      });
      // The rail's own left padding is inside the scroll box, so a rail sitting
      // at the very start reports scrollLeft == padding-left, not 0. Comparing
      // against 1 left the "previous" arrow lit up on the first card.
      var pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      btns[0].disabled = track.scrollLeft <= pad + 1;
      btns[1].disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 1;
    }

    function scrollByPage(dir) {
      var card = track.firstElementChild;
      if (!card) return;
      glideTo(track.scrollLeft + dir * (card.getBoundingClientRect().width + 20) * perView());
    }

    Array.prototype.forEach.call(btns, function (b) {
      b.addEventListener("click", function () { scrollByPage(Number(b.dataset.dir)); });
    });
    dotsWrap.addEventListener("click", function (e) {
      var d = e.target.closest(".rv-dot");
      if (!d) return;
      var card = track.firstElementChild;
      if (!card) return;
      glideTo(Number(d.dataset.page) * (card.getBoundingClientRect().width + 20) * perView());
    });
    track.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); scrollByPage(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); scrollByPage(-1); }
    });

    var ticking = false;
    track.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; renderDots(); });
    }, { passive: true });
    addEventListener("resize", renderDots);

    renderDots();
  }
})();
