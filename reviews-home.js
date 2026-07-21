/* Chifbay — homepage "Guest voices" teaser, kept live.
   Fetches the same reviews.json the reviews-auto pipeline writes, so this
   section never goes stale when a new GetYourGuide/Google review lands.
   The 3 static <figure> cards already in the HTML are left in place as a
   no-JS / pre-fetch fallback and are only swapped once real data arrives. */
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
  function sourceLabel(s) {
    return s === "google" ? "Verified · Google" : s === "tripadvisor" ? "Verified · Tripadvisor" : "Verified · GetYourGuide";
  }

  fetch("/reviews.json", { cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var reviews = (data.reviews || []).filter(function (r) { return r.text && r.text.length > 8; });
      if (!reviews.length) return;
      var top = reviews.slice(0, 3);

      // "reveal in" (not just "reveal") — the IntersectionObserver that adds
      // .in already ran on page load and won't see elements inserted later,
      // which would otherwise leave these permanently at opacity:0.
      wrap.innerHTML = top.map(function (r, i) {
        var d = i === 0 ? "" : i === 1 ? " d1" : " d2";
        return '<figure class="rev reveal in' + d + '">' +
          '<div class="st">' + stars(r.rating) + "</div>" +
          "<q>" + esc(r.text.length > 220 ? r.text.slice(0, 217) + "…" : r.text) + "</q>" +
          '<figcaption><div class="who">' + esc(r.author) + '</div><div class="src">' + sourceLabel(r.source) + "</div></figcaption>" +
          "</figure>";
      }).join("");

      if (countEl && data.aggregate) {
        countEl.textContent = data.aggregate.rating.toFixed(1) + "★ average across " + data.aggregate.count + " verified reviews";
      }
    })
    .catch(function () { /* keep the static fallback cards already in the HTML */ });
})();
