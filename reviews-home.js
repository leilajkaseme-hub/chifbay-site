/* Chifbay — homepage "Guest voices", kept live.
   Fetches the same reviews.json the reviews-auto pipeline writes, so this
   section never goes stale when a new GetYourGuide/Google/Tripadvisor review
   lands.

   The 3 static <figure> cards already in the HTML are left in place as a
   no-JS / pre-fetch fallback and are only swapped once real data arrives.
   When it does, the grid becomes a slow marquee carrying EVERY verified
   review, newest first (changed 2026-08-10 from an arrow/dot slider).

   Two identical tracks slide by 100% of their own width, so the second one
   is already in place when the first finishes — the seam never shows. It is
   a CSS animation rather than scroll position, so nothing here has to run
   per frame, and the whole thing keeps working if this file fails to load. */
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
      var cards = top.map(function (r) {
        return '<figure class="rev reveal in src-' + esc(r.source || "") + '" role="listitem">' +
          '<div class="st">' + stars(r.rating) + "</div>" +
          "<q>" + esc(r.text.length > 260 ? r.text.slice(0, 257) + "…" : r.text) + "</q>" +
          '<figcaption><div class="who">' + esc(r.author) + "</div>" +
          '<div class="src">' + sourceLabel(r.source) + "</div></figcaption>" +
          "</figure>";
      }).join("");

      // The second track is a straight copy and is hidden from assistive tech,
      // otherwise every quote would be announced twice.
      var label = esc(wrap.getAttribute("data-rail-label") || "Guest reviews");
      wrap.className = "revs marquee";
      wrap.innerHTML =
        '<div class="rv-mq">' +
          '<div class="rv-track" role="list" aria-label="' + label + '">' + cards + "</div>" +
          '<div class="rv-track" aria-hidden="true">' + cards + "</div>" +
        "</div>";

      if (countEl && data.aggregate) {
        countEl.textContent = data.aggregate.rating.toFixed(1) +
          AVG_TEXT.replace("{n}", data.aggregate.count);
      }

    })
    .catch(function () { /* keep the static fallback cards already in the HTML */ });

})();
