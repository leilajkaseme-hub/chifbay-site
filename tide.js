/* ============================================================
   Chifbay "tide" layer. One small file, no library, on every page.

   1. The page transition: logo, compass, a percentage, then the page.
   2. The hero frame that opens to the edges as you scroll (home, trips).
   3. The coastal route that draws itself as you scroll.
   4. Live prices from the booking API, wherever a page asks for them.
   5. The mobile booking bar on the trip pages.
   6. Small things: Funchal's local time in the menu, the compass cue
      on chapter heads, light on the water in the closing photo.

   Rules this file keeps:
   - Scrolling is the browser's own. Nothing is pinned or hijacked.
   - Every effect starts when its block comes on screen and stops when it
     leaves. Nothing animates off screen.
   - "Reduce motion" gets the content with no movement at all.
   - If this file never loads, every page still reads and books normally:
     the transition cover hides itself after 3 seconds from CSS alone.
   ============================================================ */
(function () {
  "use strict";
  var root = document.documentElement;
  var REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var API = window.CHIFBAY_API || "https://chifbay-booking-api.chifandcopt.workers.dev";
  var LANGS = ["fr", "de", "pt", "es", "it"];
  var seg0 = location.pathname.split("/").filter(Boolean)[0];
  var LANG = LANGS.indexOf(seg0) >= 0 ? seg0 : "en";
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* -------------------------------------------------------------- compass
     One drawing, used by the transition and by the small cues. 200 x 200,
     centre 100,100. Classes let the CSS choreograph each part. */
  function compassSVG(cls) {
    var ticks = "";
    for (var a = 0; a < 360; a += 5) {
      var major = a % 30 === 0, card = a % 90 === 0;
      var r1 = card ? 74 : major ? 79 : 84, r2 = 88;
      var rad = (a - 90) * Math.PI / 180;
      ticks += '<line x1="' + (100 + r1 * Math.cos(rad)).toFixed(2) + '" y1="' + (100 + r1 * Math.sin(rad)).toFixed(2) +
        '" x2="' + (100 + r2 * Math.cos(rad)).toFixed(2) + '" y2="' + (100 + r2 * Math.sin(rad)).toFixed(2) +
        '"' + (major ? ' class="mj"' : "") + "/>";
    }
    var rose = "";
    [45, 135, 225, 315].forEach(function (d) {
      var r = (d - 90) * Math.PI / 180;
      rose += '<line x1="100" y1="100" x2="' + (100 + 52 * Math.cos(r)).toFixed(2) + '" y2="' + (100 + 52 * Math.sin(r)).toFixed(2) + '"/>';
    });
    return '<svg class="cmp ' + (cls || "") + '" viewBox="0 0 200 200" aria-hidden="true" focusable="false">' +
      '<circle class="cmp-ring" cx="100" cy="100" r="93"/>' +
      '<g class="cmp-ticks">' + ticks + "</g>" +
      '<circle class="cmp-in" cx="100" cy="100" r="60"/>' +
      '<g class="cmp-rose">' + rose + "</g>" +
      '<g class="cmp-card"><text x="100" y="56" class="n">N</text><text x="146" y="104">E</text>' +
      '<text x="100" y="152">S</text><text x="54" y="104">W</text></g>' +
      '<g class="cmp-needle"><path class="nn" d="M100 34 L108 100 L92 100Z"/><path class="ns" d="M100 166 L108 100 L92 100Z"/>' +
      '<circle cx="100" cy="100" r="4.5"/></g></svg>';
  }
  window.cbCompass = compassSVG;

  /* =========================================================== 1. TRANSITION
     How the percentage is earned, so it never lies:
       on click        10   the request is about to go out
       headers back    40   the server answered
       body arriving   40 → 85, by bytes received when the size is known
       next page       85 → 100 once its main content and hero image are ready
     The destination is fetched once into the browser cache, so the real
     navigation that follows reuses it instead of downloading twice.
     Nothing waits on images below the fold, videos or 3D. */
  var TX_KEY = "cb-tx";
  var tx = null;          // the overlay node
  var shown = 0;          // the number on screen
  var target = 0;         // where it is heading
  var rafId = 0;
  var leaving = false;

  function norm(p) { return (p || "/").replace(/(index)?(\.html)?\/?$/, "") || "/"; }

  function overlay() {
    if (tx) return tx;
    tx = document.createElement("div");
    tx.id = "cbtx";
    tx.setAttribute("aria-hidden", "true");
    tx.innerHTML = '<div class="tx-c"><img class="tx-logo" src="/assets/logo-dark.png" alt="" width="150" height="53">' +
      compassSVG("tx-cmp") + '<div class="tx-pct"><b>0</b>%</div></div>';
    document.body.appendChild(tx);
    var live = document.createElement("p");
    live.className = "tx-sr"; live.setAttribute("role", "status"); live.id = "cbtxsr";
    document.body.appendChild(live);
    return tx;
  }
  function say(msg) { var l = document.getElementById("cbtxsr"); if (l) l.textContent = msg; }

  function tick() {
    rafId = 0;
    var b = tx && tx.querySelector(".tx-pct b");
    if (!b) return;
    // ease toward the target; a cached page arrives in a few frames
    var step = Math.max(0.6, (target - shown) * 0.22);
    shown = Math.min(target, shown + step);
    b.textContent = String(Math.round(shown));
    if (shown < target) rafId = requestAnimationFrame(tick);
  }
  function setPct(p) {
    target = Math.max(target, Math.min(100, p));
    if (REDUCE) { shown = target; var b = tx && tx.querySelector(".tx-pct b"); if (b) b.textContent = String(Math.round(shown)); return; }
    if (!rafId) rafId = requestAnimationFrame(tick);
  }
  function waitShown(p, cap) {
    return new Promise(function (res) {
      var t0 = performance.now();
      (function loop() { if (shown >= p - 0.5 || performance.now() - t0 > cap) res(); else requestAnimationFrame(loop); })();
    });
  }

  function eligible(a, e) {
    if (!a || e.defaultPrevented || e.button !== 0) return false;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
    if (a.target && a.target !== "_self") return false;
    if (a.hasAttribute("download") || a.closest("[data-no-tx]")) return false;
    var href = a.getAttribute("href") || "";
    if (!href || href.charAt(0) === "#" || /^(mailto|tel|sms|javascript|whatsapp):/i.test(href)) return false;
    var u;
    try { u = new URL(a.href, location.href); } catch (err) { return false; }
    if (u.origin !== location.origin) return false;
    if (/\/booking-done/.test(u.pathname) || /\/booking-done/.test(location.pathname)) return false;
    var last = u.pathname.split("/").pop();
    if (last.indexOf(".") >= 0 && !/\.html?$/i.test(last)) return false;     // files, images, pdf
    if (/^\/(assets|ig|social|vendor|data)\//.test(u.pathname)) return false;
    // same page, other anchor: let the browser scroll
    if (norm(u.pathname) === norm(location.pathname) && u.search === location.search) return false;
    return u;
  }

  function go(u) {
    if (leaving) return;
    leaving = true;
    overlay();
    shown = 0; target = 0;
    root.classList.add("tx-out");
    // the overlay is in the DOM now; next frame starts its CSS sequence
    requestAnimationFrame(function () { tx.classList.add("on"); });
    say(document.documentElement.lang === "fr" ? "Chargement" : "Loading");
    setPct(10);
    var started = performance.now();
    var MIN = REDUCE ? 0 : 420;     // long enough to see the needle settle, no longer
    var done = false;
    function leave() {
      if (done) return; done = true;
      setPct(85);
      waitShown(85, 400).then(function () {
        var wait = Math.max(0, MIN - (performance.now() - started));
        setTimeout(function () {
          try { sessionStorage.setItem(TX_KEY, JSON.stringify({ t: Date.now(), u: u.pathname + u.search, p: 85 })); } catch (e) {}
          location.assign(u.href);
          // a navigation that never happens (download, 204, blocked): give the page back
          setTimeout(release, 8000);
        }, wait);
      });
    }
    var slow = setTimeout(leave, 4000);      // the network is slow: just go, the browser shows its own progress
    if (!window.fetch) { leave(); return; }
    fetch(u.href, { credentials: "same-origin" }).then(function (r) {
      setPct(40);
      var len = Number(r.headers.get("content-length")) || 0;
      if (!r.body || !r.body.getReader) return r.text();
      var rd = r.body.getReader(), got = 0;
      return (function pump() {
        return rd.read().then(function (c) {
          if (c.done) return;
          got += c.value.length;
          setPct(len ? 40 + 45 * Math.min(1, got / len) : Math.min(80, 40 + got / 4000));
          return pump();
        });
      })();
    }).then(function () { clearTimeout(slow); leave(); }, function () { clearTimeout(slow); leave(); });
  }

  function release() {
    leaving = false;
    root.classList.remove("tx-out", "cbtx");
    if (tx) { tx.classList.remove("on", "in", "reveal"); }
  }

  /* Arriving: the inline <head> script has already put up the cover (class
     cbtx on <html>) so there is no flash of the page underneath. Finish the
     count against real readiness, then reveal. */
  function arrive() {
    // consumed once, so a stale entry can never cover a later page
    try { sessionStorage.removeItem(TX_KEY); } catch (e) {}
    if (!root.classList.contains("cbtx")) return;
    overlay();
    tx.classList.add("on", "in");
    root.classList.add("tx-live");          // the live overlay replaces the CSS cover
    shown = 85; target = 85;
    var b = tx.querySelector(".tx-pct b"); if (b) b.textContent = "85";
    setPct(90);
    var hero = document.querySelector(".hero .hbg, .bkhero .bkhbg img, .hero, main img, article img");
    var src = null;
    if (hero) {
      if (hero.tagName === "IMG") src = hero.currentSrc || hero.src;
      else {
        var bg = getComputedStyle(hero).backgroundImage;
        var m = /url\(["']?([^"')]+)/.exec(bg || "");
        if (m) src = m[1];
      }
    }
    var ready = new Promise(function (res) {
      if (!src) return res();
      var im = new Image();
      im.onload = im.onerror = function () { res(); };
      im.src = src;
      if (im.complete) res();
    });
    var cap = new Promise(function (res) { setTimeout(res, 1400); });   // never hold the page hostage to one photo
    Promise.race([ready, cap]).then(function () {
      setPct(100);
      return waitShown(100, 500);
    }).then(function () {
      tx.classList.add("reveal");
      root.classList.add("tx-reveal");
      var end = function () { root.classList.remove("cbtx", "tx-live", "tx-reveal"); tx.classList.remove("on", "in", "reveal"); };
      setTimeout(end, REDUCE ? 160 : 720);
    });
    // the cover must never outlive a broken page
    setTimeout(function () {
      if (!root.classList.contains("cbtx")) return;
      root.classList.remove("cbtx", "tx-live", "tx-reveal");
      tx.classList.remove("on", "in", "reveal");
    }, 4000);
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    var u = eligible(a, e);
    if (!u) return;
    e.preventDefault();
    go(u);
  });
  // Back from the next page with the old one restored from memory: drop the cover.
  addEventListener("pageshow", function (e) { if (e.persisted) release(); });
  arrive();

  /* ============================================================ helpers */
  function inView(el, cb, opts) {
    if (!("IntersectionObserver" in window)) { cb(true); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (x) { cb(x.isIntersecting, x); }); }, opts || { rootMargin: "120px 0px" });
    io.observe(el);
  }
  var scrollers = [];
  var sraf = 0;
  function onScroll(fn) { scrollers.push(fn); }
  function runScroll() { sraf = 0; scrollers.forEach(function (f) { f(); }); }
  addEventListener("scroll", function () { if (!sraf) sraf = requestAnimationFrame(runScroll); }, { passive: true });
  addEventListener("resize", function () { if (!sraf) sraf = requestAnimationFrame(runScroll); }, { passive: true });

  /* ====================================================== 1b. LAZY PHOTOS
     Photos below the first screen carry data-lzbg and their image in --bg
     (scripts/lib/webp.mjs writes them). They load when they come within
     600 px of the screen: before this, a phone downloaded every photo of the
     page on arrival (6.2 MB on the home page, 4 Oct 2026). tide.css shows
     them at once when JavaScript is off. The map card's photo (atlas.css
     .mapstub) waits the same way. */
  (function () {
    var lz = $$("[data-lzbg], .mapstub");
    if (!lz.length) return;
    var show = function (el) { el.classList.add("lzin"); };
    if (!("IntersectionObserver" in window)) { lz.forEach(show); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } });
    }, { rootMargin: "600px 600px" });
    lz.forEach(function (el) { io.observe(el); });
    // printing should show every photo
    addEventListener("beforeprint", function () { lz.forEach(show); });
  })();

  /* ========================================================= 2. HERO FRAME
     The hero sits inside a rounded frame on the white page. As the visitor
     scrolls the first screen, the frame opens to the edges. It starts at
     scroll 0 and is finished at 45% of the hero's height. Desktop only:
     on a phone the frame is a fixed thin margin, nothing moves. */
  var frame = document.querySelector("header.hero");
  if (frame && !REDUCE && matchMedia("(min-width:861px)").matches) {
    var last = -1;
    onScroll(function () {
      var h = frame.offsetHeight || 1;
      var k = Math.min(1, Math.max(0, scrollY / (h * 0.45)));
      if (Math.abs(k - last) < 0.004) return;
      last = k;
      frame.style.setProperty("--fk", k.toFixed(3));
    });
    runScroll();
  }

  /* ======================================================== 3. THE ROUTE
     Markup is a plain ordered list of stops (readable, crawlable). The map
     is drawn here from the real sea distances in data-km, so the spacing on
     screen matches the coast. The line draws with scroll: it starts when
     the block's top reaches the bottom of the screen and is complete when
     the block's bottom reaches 70% of the screen. Each stop lights up as
     the line passes it. Scrolling back undraws it. */
  $$(".t-route").forEach(function (sec) {
    var stops = $$(".t-stop", sec);
    var host = sec.querySelector(".t-map");
    if (!stops.length || !host) return;
    var km = stops.map(function (s) { return Number(s.getAttribute("data-km")) || 0; });
    var max = Math.max.apply(null, km) || 1;
    // Real positions (lat, lon). The map uses ONE scale for both axes, so the
    // coast has its true shape and the gaps between stops their true length.
    var GEO = {
      funchal: [32.6455, -16.9115], camara: [32.6478, -16.9772], girao: [32.6557, -17.0045],
      faja: [32.6605, -17.0322], brava: [32.6726, -17.0647], sol: [32.6795, -17.1040]
    };
    var COAST = [[32.6420, -16.8850], [32.6455, -16.9115], [32.6440, -16.9300], [32.6405, -16.9500], [32.6480, -16.9772],
      [32.6500, -16.9900], [32.6560, -17.0045], [32.6590, -17.0200], [32.6610, -17.0320], [32.6660, -17.0480],
      [32.6730, -17.0650], [32.6755, -17.0850], [32.6800, -17.1040], [32.6880, -17.1300]];
    var W = 1000, H = 380, PAD = 30;
    var LONW = -17.13, LONE = -16.885, KX = 93.7, KY = 110.6;          // km per degree at 32.65 N
    var S = (W - 2 * PAD) / ((LONE - LONW) * KX);                       // px per km
    var LATN = 32.6795 + 118 / S / KY;                                  // puts Ponta do Sol 118 px down
    function px(ll) { return [PAD + (ll[1] - LONW) * KX * S, (LATN - ll[0]) * KY * S]; }
    function smooth(p) {                                                // Catmull-Rom through the points
      var d = "M" + p[0][0].toFixed(1) + "," + p[0][1].toFixed(1);
      for (var i = 0; i < p.length - 1; i++) {
        var p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
        d += " C" + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + "," + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) +
          " " + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + "," + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) +
          " " + p2[0].toFixed(1) + "," + p2[1].toFixed(1);
      }
      return d;
    }
    var coast = COAST.map(px).reverse();                                // west to east
    var coastD = smooth(coast);
    var landD = "M0,0 L0," + coast[0][1].toFixed(1) + " " + coastD.slice(1) + " L" + W + "," + coast[coast.length - 1][1].toFixed(1) + " L" + W + ",0Z";
    var contours = [16, 36, 62, 94].map(function (off, i) {
      return '<path class="topo" style="opacity:' + (0.5 - i * 0.1).toFixed(2) + '" d="' + smooth(coast.map(function (q) { return [q[0], q[1] - off]; })) + '"/>';
    }).join("");
    // the boat runs a little offshore, Funchal first, west from there
    var pts = stops.map(function (s) { return px(GEO[s.getAttribute("data-id")] || [32.65, -17]); });
    var sea = pts.map(function (q) { return [q[0], q[1] + 22]; });
    var d = smooth(sea);
    var names = stops.map(function (s) { var h = s.querySelector("h3"); return h ? h.textContent : ""; });
    var marks = sea.map(function (q, k) {
      return '<g class="t-pin" transform="translate(' + q[0].toFixed(1) + "," + q[1].toFixed(1) + ')">' +
        '<circle r="13" class="halo"/><circle r="5.5" class="dot"/><text class="num" y="-14">' + String(k + 1).padStart(2, "0") + "</text>" +
        '<text class="sn" y="32">' + names[k].replace(/[<&]/g, "") + "</text></g>";
    }).join("");
    var bar = 2 * S;                                                    // a 2 km scale bar
    host.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">' +
      '<defs><clipPath id="tland"><path d="' + landD + '"/></clipPath></defs>' +
      '<path class="land" d="' + landD + '"/><g clip-path="url(#tland)">' + contours + '</g><path class="coast" d="' + coastD + '"/>' +
      '<text class="area" x="' + (W - 60) + '" y="44" text-anchor="end">MADEIRA</text>' +
      '<text class="area sea-t" x="40" y="' + (H - 30) + '">ATLANTIC</text>' +
      '<g class="north" transform="translate(56,56)"><circle r="16"/><path d="M0,-11 L5,4 L0,1 L-5,4Z"/><text y="-22">N</text></g>' +
      '<g class="scale" transform="translate(250,' + (H - 30) + ')"><path d="M0,0 H' + bar.toFixed(1) + '"/><path d="M0,-5 V0 M' + bar.toFixed(1) + ',-5 V0"/><text x="' + (bar / 2).toFixed(1) + '" y="-9">2 km</text></g>' +
      '<path class="sea-bg" d="' + d + '"/><path class="sea-fg" d="' + d + '"/>' + marks +
      // the boat, seen from above, bow pointing along +x; rotated to the course
      '<g class="t-boat"><g class="t-boat-r"><path class="wake" d="M-26,0 L-12,-3 L-12,3Z"/>' +
      '<path class="hull" d="M-12,-5.5 L7,-5.5 Q15,-2 16,0 Q15,2 7,5.5 L-12,5.5 Q-14,0 -12,-5.5Z"/>' +
      '<rect class="deck" x="-6" y="-3" width="9" height="6" rx="1.5"/></g></g>' + "</svg>";
    var fg = host.querySelector(".sea-fg");
    var L = fg.getTotalLength();
    // where along the path each pin sits, as a share of the length
    var at = sea.map(function (p) {
      var best = 0, bd = 1e9;
      for (var s = 0; s <= 200; s++) {
        var q = fg.getPointAtLength(L * s / 200), dd = Math.hypot(q.x - p[0], q.y - p[1]);
        if (dd < bd) { bd = dd; best = s / 200; }
      }
      return best;
    });
    fg.style.strokeDasharray = L;
    var pins = $$(".t-pin", host);
    var boat = host.querySelector(".t-boat"), boatR = host.querySelector(".t-boat-r");
    // how far along the coast the chosen trip goes (share of the full line)
    var lim = 1, last = 0;
    var svg = host.firstChild;
    var lang = (root.lang || "en").slice(0, 2);
    var names = stops.map(function (s) { var h = s.querySelector("h3"); return h ? h.textContent : ""; });
    // a caption names the stop the boat has reached: readable at any width,
    // where pin labels would be too small on a phone
    var cap = document.createElement("div");
    cap.className = "t-mapcap"; cap.setAttribute("aria-hidden", "true");
    host.appendChild(cap);
    function paint(k) {
      if (k === undefined) k = last;
      last = k;
      var reach = k * lim, lastOn = 0;
      fg.style.strokeDashoffset = (L * (1 - reach)).toFixed(1);
      at.forEach(function (v, j) {
        var on = reach >= v - 0.01, out = v > lim + 0.01;
        if (on && !out) lastOn = j;
        pins[j].classList.toggle("on", on && !out);
        pins[j].classList.toggle("off", out);
        stops[j].classList.toggle("on", on && !out);
        stops[j].classList.toggle("off", out);
      });
      cap.textContent = String(lastOn + 1).padStart(2, "0") + " · " + names[lastOn];
      // the boat rides the tip of the line and turns with the coast
      var len = Math.max(0.5, L * reach), p = fg.getPointAtLength(len),
        q = fg.getPointAtLength(Math.min(L, len + 2)), b = fg.getPointAtLength(Math.max(0, len - 2));
      var ang = Math.atan2(q.y - b.y, q.x - b.x) * 180 / Math.PI;
      boat.setAttribute("transform", "translate(" + p.x.toFixed(1) + "," + p.y.toFixed(1) + ")");
      boatR.setAttribute("transform", "rotate(" + ang.toFixed(1) + ")");
      boat.classList.toggle("moving", reach > 0.005 && reach < lim - 0.005);
    }

    /* The view fits the WHOLE chosen route (2 Oct audit: the old phone view
       followed the boat and slid away before Ponta do Sol). Computed once per
       route and per size, never during playback. */
    var view = [0, 0, W, H];
    // map units per screen pixel: labels keep one size on screen whatever the zoom
    function unit(vw) { host.style.setProperty("--u", (vw / Math.max(1, host.clientWidth)).toFixed(3)); }
    function fit(animate) {
      var asp = host.clientWidth / Math.max(1, host.clientHeight) || W / H;
      var xs = [], ys = [];
      for (var i = 0; i <= 40; i++) { var pt = fg.getPointAtLength(L * lim * i / 40); xs.push(pt.x); ys.push(pt.y); }
      var pad = 70, x0 = Math.min.apply(null, xs) - pad, x1 = Math.max.apply(null, xs) + pad,
        y0 = Math.min.apply(null, ys) - pad, y1 = Math.max.apply(null, ys) + pad + 30;
      var w = Math.max(x1 - x0, 420), h = Math.max(y1 - y0, w / asp);
      w = Math.max(w, h * asp);
      var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      var to = [cx - w / 2, cy - h / 2, w, h];
      if (!animate || REDUCE) { view = to; unit(to[2]); svg.setAttribute("viewBox", to.map(function (v) { return v.toFixed(1); }).join(" ")); return; }
      var from = view.slice(), t0 = performance.now();
      (function step(now) {
        var e = Math.min(1, (now - t0) / 650), k = e < .5 ? 2 * e * e : 1 - Math.pow(-2 * e + 2, 2) / 2;
        view = from.map(function (v, i) { return v + (to[i] - v) * k; });
        unit(view[2]);
        svg.setAttribute("viewBox", view.map(function (v) { return v.toFixed(1); }).join(" "));
        if (e < 1) requestAnimationFrame(step);
      })(t0);
    }
    var rz = 0;
    addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { fit(false); }, 150); });

    /* Playback on its own clock: starts when the map is well in view, pauses
       off screen, holds the arrival, never resets by itself. Scrolling never
       sets the progress. Replay and Pause are real buttons. */
    var LB = { en: ["Pause the journey", "Play the journey", "Replay the journey"], fr: ["Mettre en pause", "Lancer le trajet", "Rejouer le trajet"],
      de: ["Fahrt anhalten", "Fahrt abspielen", "Fahrt wiederholen"], pt: ["Pausar o percurso", "Reproduzir o percurso", "Repetir o percurso"],
      es: ["Pausar la ruta", "Reproducir la ruta", "Repetir la ruta"], it: ["Metti in pausa", "Riproduci il percorso", "Ripeti il percorso"] }[lang] ||
      ["Pause the journey", "Play the journey", "Replay the journey"];
    var ctl = document.createElement("div");
    ctl.className = "t-mapctl";
    ctl.innerHTML = '<button type="button" class="t-mc-pp"></button><button type="button" class="t-mc-rp" aria-label="' + LB[2] + '" title="' + LB[2] + '">' +
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v3h3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
    host.appendChild(ctl);
    var ppBtn = ctl.querySelector(".t-mc-pp"), rpBtn = ctl.querySelector(".t-mc-rp");
    var prog = 0, playing = false, visible = false, userPaused = false, done = false, lastT = 0, raf = 0;
    function dur() { return 8000 + 4000 * lim; }                       // 8 to 12 seconds
    function drawBtn() {
      var showPause = playing && !done;
      ppBtn.setAttribute("aria-label", showPause ? LB[0] : LB[1]); ppBtn.title = ppBtn.getAttribute("aria-label");
      ppBtn.innerHTML = showPause ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3h3v10H4zM9 3h3v10H9z"/></svg>'
        : '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z"/></svg>';
      ppBtn.hidden = done;
    }
    function tick(now) {
      raf = 0;
      if (!playing) return;
      prog = Math.min(1, prog + (now - lastT) / dur()); lastT = now;
      paint(prog);
      if (prog >= 1) { playing = false; done = true; drawBtn(); return; }
      raf = requestAnimationFrame(tick);
    }
    function play() { if (done || playing || !visible) { drawBtn(); return; } playing = true; lastT = performance.now(); drawBtn(); if (!raf) raf = requestAnimationFrame(tick); }
    function pause() { playing = false; drawBtn(); }
    function restart() { prog = 0; done = false; userPaused = false; paint(0); if (REDUCE) { prog = 1; done = true; paint(1); drawBtn(); return; } play(); }
    ppBtn.addEventListener("click", function () { if (playing) { userPaused = true; pause(); } else { userPaused = false; play(); } });
    rpBtn.addEventListener("click", restart);

    /* Trip picker (home page, where the map shows the whole coast): each
       option draws only its own route and marks where it turns back. The
       routes are the booking page's own (booking-content.js). */
    // which trips this map offers: the home page shows all of them, a trip
    // page only its own two lengths (2 Oct audit), starting on the longer one,
    // which is the full route the map first draws
    var KIND = /\/sunset-cruise(\.html)?$/.test(location.pathname) ? [3, 4]
      : /\/hidden-coves-half-day(\.html)?$/.test(location.pathname) ? [1, 2] : [0, 1, 2, 3, 4];
    if (stops.length >= 6 || KIND.length === 2) {
      var TL = {
        en: ["Whole coast", "Day 2h30", "Day 3h", "Sunset 2h", "Sunset 2h30", "Show the route of"],
        fr: ["Toute la côte", "Jour 2h30", "Jour 3h", "Coucher de soleil 2h", "Coucher de soleil 2h30", "Voir l'itinéraire de"],
        de: ["Ganze Küste", "Tag 2,5 Std.", "Tag 3 Std.", "Sonnenuntergang 2 Std.", "Sonnenuntergang 2,5 Std.", "Route anzeigen für"],
        pt: ["Toda a costa", "Dia 2h30", "Dia 3h", "Pôr do sol 2h", "Pôr do sol 2h30", "Ver o percurso de"],
        es: ["Toda la costa", "Día 2h30", "Día 3h", "Atardecer 2h", "Atardecer 2h30", "Ver la ruta de"],
        it: ["Tutta la costa", "Giorno 2h30", "Giorno 3h", "Tramonto 2h", "Tramonto 2h30", "Mostra il percorso di"]
      }[lang] || null;
      var TURN = ["sol", "brava", "sol", "girao", "brava"];
      if (TL) {
        var ids = stops.map(function (s) { return s.getAttribute("data-id"); });
        var pick = document.createElement("div");
        pick.className = "t-trips";
        pick.setAttribute("role", "group");
        pick.setAttribute("aria-label", TL[5]);
        pick.innerHTML = KIND.map(function (i, n) {
          var on = KIND.length === 2 ? n === 1 : i === 0;
          return '<button type="button" aria-pressed="' + on + '" data-turn="' + TURN[i] + '"' + (i === 0 ? " data-whole" : "") + ">" + TL[i] + "</button>";
        }).join("");
        host.parentNode.insertBefore(pick, host);
        $$("button", pick).forEach(function (btn) {
          btn.addEventListener("click", function () {
            $$("button", pick).forEach(function (x) { x.setAttribute("aria-pressed", String(x === btn)); });
            var j = ids.indexOf(btn.getAttribute("data-turn"));
            lim = j >= 0 ? at[j] : 1;
            pins.forEach(function (pn, i) { pn.classList.toggle("turn", !btn.hasAttribute("data-whole") && i === j); });
            fit(true);
            restart();                                                  // the chosen route plays from the start
          });
        });
      }
    }
    // a stop card in focus or under the pointer lights its pin
    stops.forEach(function (st, j) {
      st.tabIndex = 0;
      var hl = function (on) { return function () { pins[j].classList.toggle("hl", on); }; };
      st.addEventListener("mouseenter", hl(true)); st.addEventListener("mouseleave", hl(false));
      st.addEventListener("focus", hl(true)); st.addEventListener("blur", hl(false));
    });
    fit(false);
    if (REDUCE) { prog = 1; done = true; paint(1); drawBtn(); return; }
    paint(0); drawBtn();
    inView(host, function (v) { visible = v; if (v && !userPaused) play(); else if (!v) pause(); }, { threshold: 0.4 });
  });

  /* Sunset trip departure, the owner's rule of 4 Oct 2026: 1 h 15 before that
     day's sunset in Funchal, rounded down to the quarter hour. The sunset is
     the NOAA solar calculator for lat 32.65 N, lon 16.9083 W, in
     Atlantic/Madeira time: the same code as scripts/lib/sunset.mjs (keep the
     copies in tide.js and booking.js in step with it). */
  var SUN = (function () {
    var LAT = 32.65, LON = -16.9083, R = Math.PI / 180;
    var fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Atlantic/Madeira", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    function utcMin(y, m, d) {
      var t = 720;
      for (var i = 0; i < 3; i++) {
        var jd = Date.UTC(y, m - 1, d) / 864e5 + 2440587.5 + t / 1440, T = (jd - 2451545) / 36525;
        var L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360, M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
        var e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
        var C = Math.sin(M * R) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M * R) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * R) * 0.000289;
        var om = 125.04 - 1934.136 * T, lam = L0 + C - 0.00569 - 0.00478 * Math.sin(om * R);
        var eps = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(om * R);
        var dec = Math.asin(Math.sin(eps * R) * Math.sin(lam * R)) / R, yv = Math.pow(Math.tan(eps / 2 * R), 2);
        var eq = 4 / R * (yv * Math.sin(2 * L0 * R) - 2 * e * Math.sin(M * R) + 4 * e * yv * Math.sin(M * R) * Math.cos(2 * L0 * R) -
          0.5 * yv * yv * Math.sin(4 * L0 * R) - 1.25 * e * e * Math.sin(2 * M * R));
        var ha = Math.acos(Math.cos(90.833 * R) / (Math.cos(LAT * R) * Math.cos(dec * R)) - Math.tan(LAT * R) * Math.tan(dec * R)) / R;
        t = 720 - 4 * LON - eq + 4 * ha;
      }
      return t;
    }
    function at(date, lead) {
      var p = date.split("-").map(Number);
      return fmt.format(new Date(Date.UTC(p[0], p[1] - 1, p[2]) + (utcMin(p[0], p[1], p[2]) - lead) * 6e4));
    }
    return {
      sunset: function (date) { return at(date, 0); },
      departure: function (date) {
        var x = at(date, 75).split(":").map(Number), q = x[0] * 60 + Math.floor(x[1] / 15) * 15;
        return String(Math.floor(q / 60)).padStart(2, "0") + ":" + String(q % 60).padStart(2, "0");
      },
      today: function () {
        return new Intl.DateTimeFormat("en-CA", { timeZone: "Atlantic/Madeira", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      },
      // GET /v1/sunset?from=&to= on the booking server, when it exists:
      // { date: {sunset, departure} } in whatever wrapper it comes in
      pick: function (res, date) {
        if (!res) return null;
        var d = res.days || res.dates || res;
        if (Array.isArray(d)) { for (var i = 0; i < d.length; i++) if (d[i] && d[i].date === date) return d[i]; return null; }
        return d[date] || null;
      }
    };
  })();

  /* ================================================ 4a. SUNSET DEPARTURE
     The pages say "1 h 15 before sunset" in words; an element with
     data-cb-sundep (hidden in the HTML, so no stale time is ever indexed)
     gets today's real departure in its <b>, from the booking server when it
     answers, worked out here when it does not. */
  (function () {
    var els = $$("[data-cb-sundep]");
    if (!els.length) return;
    var day = SUN.today();
    var show = function (hm) {
      els.forEach(function (el) { var b = el.querySelector("b") || el; b.textContent = hm; el.hidden = false; });
    };
    show(SUN.departure(day));
    if (!window.fetch) return;
    fetch(API + "/v1/sunset?from=" + day + "&to=" + day).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (res) { var x = SUN.pick(res, day); if (x && /^\d\d:\d\d$/.test(x.departure)) show(x.departure); })
      .catch(function () {});
  })();

  /* ======================================================= 4. LIVE PRICES
     Any element with data-cb-price="<trip>/<variant>" (or "<trip>" for the
     lowest, or "min" for the lowest overall) gets the live amount from
     /v1/catalogue. The number already in the HTML stays if the API is down,
     so the page is never empty and search engines read a real price. */
  var priced = $$("[data-cb-price],[data-cb-dur],[data-cb-times]");
  if (priced.length && window.fetch) {
    fetch(API + "/v1/catalogue").then(function (r) { return r.ok ? r.json() : null; }).then(function (cat) {
      if (!cat || !cat.trips) return;
      var cur = (cat.currency || "eur").toUpperCase();
      var fmt = function (cents) {
        try { return new Intl.NumberFormat(root.lang || "en", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(cents / 100); }
        catch (e) { return "€" + Math.round(cents / 100); }
      };
      var all = [];
      Object.keys(cat.trips).forEach(function (t) {
        Object.keys(cat.trips[t].variants).forEach(function (v) { all.push({ t: t, v: v, a: cat.trips[t].variants[v].amount, m: cat.trips[t].variants[v].minutes }); });
      });
      var min = function (list) { return list.reduce(function (m, x) { return x.a < m ? x.a : m; }, Infinity); };
      $$("[data-cb-price]").forEach(function (el) {
        var k = el.getAttribute("data-cb-price"), parts = k.split("/"), list;
        if (k === "min") list = all;
        else list = all.filter(function (x) { return x.t === parts[0] && (!parts[1] || x.v === parts[1]); });
        var a = min(list);
        if (isFinite(a)) { el.textContent = fmt(a); el.classList.add("live"); }
      });
      $$("[data-cb-times]").forEach(function (el) {
        // the sunset time moves every day: those pages use data-cb-sundep (4a)
        if (el.getAttribute("data-cb-times") === "sunset") return;
        var t = cat.trips[el.getAttribute("data-cb-times")];
        if (t && t.times && t.times.length) el.textContent = t.times.join(" · ");
      });
      $$("[data-cb-dur]").forEach(function (el) {
        var t = cat.trips[el.getAttribute("data-cb-dur")];
        if (!t) return;
        var ms = Object.keys(t.variants).map(function (v) { return t.variants[v].minutes; }).sort(function (a, b) { return a - b; });
        var h = function (m) { return Math.floor(m / 60) + "h" + (m % 60 ? String(m % 60).padStart(2, "0") : ""); };
        el.textContent = ms.map(h).join(" / ");
      });
    }).catch(function () {});
  }

  /* ==================================================== 5. MOBILE BOOK BAR
     Trip pages only (an element .t-sbar in the markup). It shows once the
     hero's own button has scrolled away, and hides again when a booking
     button or the footer is on screen, so it never covers the thing it
     points to. The WhatsApp button moves up while it shows. */
  var bar = document.querySelector(".t-sbar");
  if (bar) {
    var heroEnd = document.querySelector(".hero, .bkhero");
    var blockers = $$(".reserve, footer, .t-cmp, #book, .bkwrap");
    var vis = { hero: true, block: 0 };
    var upd = function () {
      var show = !vis.hero && vis.block === 0;
      bar.classList.toggle("show", show);
      root.classList.toggle("sbar-on", show);
    };
    if (heroEnd) inView(heroEnd, function (v) { vis.hero = v; upd(); }, { rootMargin: "0px" });
    else vis.hero = false;
    blockers.forEach(function (b) {
      var was = false;
      inView(b, function (v) { if (v !== was) { vis.block += v ? 1 : -1; was = v; upd(); } }, { rootMargin: "0px" });
    });
    upd();
  }

  /* ========================================================= 6. SMALL THINGS */
  // Funchal's local time in the menu bar. Madeira is on Lisbon time.
  var clock = document.querySelector(".t-clock b");
  if (clock) {
    var f;
    try { f = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Atlantic/Madeira" }); } catch (e) { f = null; }
    var set = function () { if (f) clock.textContent = f.format(new Date()); };
    set(); setInterval(set, 30000);
  }

  // Compass cue on chapter heads: a small rose that turns as its chapter
  // scrolls through the screen. One needle angle per frame, nothing else.
  var heads = $$(".chead");
  if (heads.length) {
    heads.forEach(function (h) {
      if (h.querySelector(".cmp")) return;
      var s = document.createElement("span");
      s.className = "t-cue";
      s.setAttribute("aria-hidden", "true");
      // a small, bold version of the same compass: at 20 px the full one's
      // hairlines disappear
      s.innerHTML = '<svg class="cmp cmp-sm" viewBox="0 0 200 200" focusable="false"><circle cx="100" cy="100" r="86" fill="none" stroke="currentColor" stroke-width="14"/>' +
        '<path d="M100 14v26M100 160v26M14 100h26M160 100h26" stroke="currentColor" stroke-width="14"/>' +
        '<g class="cmp-needle"><path class="nn" d="M100 44 L118 100 L82 100Z"/><path class="ns" d="M100 156 L118 100 L82 100Z"/></g></svg>';
      h.insertBefore(s, h.firstChild);
    });
    if (!REDUCE) {
      var live = [];
      heads.forEach(function (h) { inView(h, function (v) { var i = live.indexOf(h); if (v && i < 0) live.push(h); if (!v && i >= 0) live.splice(i, 1); }); });
      onScroll(function () {
        live.forEach(function (h) {
          var r = h.getBoundingClientRect();
          var k = 1 - Math.min(1, Math.max(0, r.top / innerHeight));
          var n = h.querySelector(".cmp-needle");
          if (n) n.style.transform = "rotate(" + (-60 + 60 * k).toFixed(1) + "deg)";
        });
      });
    }
  }

  // Light on the water: a soft moving caustic over the closing photo.
  // WebGL, desktop only, paused off screen; without WebGL nothing shows.
  $$(".t-caustic").forEach(function (cv) {
    if (REDUCE || !matchMedia("(min-width:861px) and (hover:hover)").matches) return;
    var gl = cv.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return;
    var vs = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
    var fs = "precision mediump float;uniform vec2 r;uniform float t;" +
      "float c(vec2 u){vec2 p=mod(u*6.2832,6.2832)-250.;vec2 i=p;float s=1.;for(int n=0;n<4;n++){float k=t*(1.-3.5/float(n+1));" +
      "i=p+vec2(cos(k-i.x)+sin(k+i.y),sin(k-i.y)+cos(k+i.x));s+=1./length(vec2(p.x/(sin(i.x+k)/.005),p.y/(cos(i.y+k)/.005)));}" +
      "s/=4.;s=1.17-pow(s,1.4);return pow(abs(s),8.);}" +
      "void main(){vec2 u=gl_FragCoord.xy/r;u.x*=r.x/r.y;float v=c(u*.55);float fade=smoothstep(.0,.55,1.-gl_FragCoord.y/r.y);" +
      "gl_FragColor=vec4(vec3(1.,.95,.86)*v*.22*fade,v*.22*fade);}";
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    var pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    gl.useProgram(pr);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var ur = gl.getUniformLocation(pr, "r"), ut = gl.getUniformLocation(pr, "t");
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    var on = false, raf = 0, t0 = performance.now();
    function size() { var s = 0.5; cv.width = Math.max(2, cv.clientWidth * s | 0); cv.height = Math.max(2, cv.clientHeight * s | 0); gl.viewport(0, 0, cv.width, cv.height); }
    function frameDraw(now) {
      raf = 0; if (!on) return;
      gl.uniform2f(ur, cv.width, cv.height); gl.uniform1f(ut, (now - t0) / 4200);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(frameDraw);
    }
    size(); addEventListener("resize", size, { passive: true });
    cv.classList.add("on");
    inView(cv, function (v) { on = v && !document.hidden; if (on && !raf) raf = requestAnimationFrame(frameDraw); }, { rootMargin: "0px" });
    document.addEventListener("visibilitychange", function () { on = !document.hidden && on; if (on && !raf) raf = requestAnimationFrame(frameDraw); });
  });

  // The boat: numbered points on the real drone photo. Hover, focus or tap
  // a number to read it; the list beside the photo says the same in text.
  $$(".t-boat").forEach(function (b) {
    var items = $$(".t-hs", b), notes = $$(".t-bnote", b);
    function pick(i) {
      items.forEach(function (x, k) { x.classList.toggle("on", k === i); x.setAttribute("aria-pressed", String(k === i)); });
      notes.forEach(function (x, k) { x.classList.toggle("on", k === i); });
    }
    items.forEach(function (x, i) {
      x.addEventListener("click", function () { pick(i); });
      x.addEventListener("mouseenter", function () { pick(i); });
      x.addEventListener("focus", function () { pick(i); });
    });
    notes.forEach(function (x, i) { x.addEventListener("mouseenter", function () { pick(i); }); });
    if (items.length) pick(0);
  });

  /* ---------------------------------------- hero video: pause control
     A visible button to stop the video (WCAG 2.2.2), the video never runs
     off screen, and a visitor's pause is never undone: the inline loader
     in the page checks data-hold before any retry. */
  (function () {
    var v = document.getElementById("heroVid");
    var hero = v && v.closest("header");
    if (!hero) return;
    var lang = (document.documentElement.lang || "en").slice(0, 2);
    var L = { en: ["Pause the video", "Play the video"], fr: ["Mettre la vidéo en pause", "Lire la vidéo"],
      de: ["Video anhalten", "Video abspielen"], pt: ["Pausar o vídeo", "Reproduzir o vídeo"],
      es: ["Pausar el vídeo", "Reproducir el vídeo"], it: ["Metti in pausa il video", "Riproduci il video"] }[lang] ||
      ["Pause the video", "Play the video"];
    var b = document.createElement("button");
    b.type = "button";
    b.className = "t-vid";
    function draw() {
      var off = v.paused || v.dataset.hold;
      b.setAttribute("aria-label", off ? L[1] : L[0]);
      b.innerHTML = off
        ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z"/></svg>'
        : '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z"/></svg>';
    }
    b.addEventListener("click", function () {
      if (v.dataset.hold || v.paused) { delete v.dataset.hold; var r = v.play(); if (r && r.catch) r.catch(function () {}); }
      else { v.dataset.hold = "1"; v.pause(); }
      draw();
    });
    v.addEventListener("play", draw);
    v.addEventListener("pause", draw);
    hero.appendChild(b);
    draw();
    inView(hero, function (on) {
      if (!on) { if (!v.paused) { v.dataset.auto = "1"; v.pause(); } }
      else if (v.dataset.auto && !v.dataset.hold) { delete v.dataset.auto; var r = v.play(); if (r && r.catch) r.catch(function () {}); }
    }, { rootMargin: "0px" });
  })();

  /* ---------------------------------------- media chapter: tiles open in view */
  $$("section.minc .mi").forEach(function (f) {
    if (REDUCE) { f.classList.add("open"); return; }
    inView(f, function (on) { if (on) f.classList.add("open"); }, { rootMargin: "0px 0px -18% 0px" });
  });

  /* ---------------------------------------- the boat down the page
     2 Oct audit: one boat sails from the end of the hero down to the
     closing booking invitation, in the right page margin (the lane). Its
     place follows scroll, so it keeps pace with the reader. Wherever
     anything sits in the lane (text, photo, button, a strip that runs to
     the edge) the boat and its wake are hidden for that stretch, so they
     never cross content. Navy on light surfaces, white on dark ones.
     Only on the story pages (home, experiences, trip pages), never on
     booking or other functional pages. Reduced motion: no boat at all. */
  (function () {
    var hero = document.querySelector("header.hero");
    if (REDUCE || !hero || !document.querySelector("header.hero-v, .t-route, .t-cmp")) return;
    if (/\/(book|checkout|booking|practical|contact|terms|privacy)/.test(location.pathname)) return;
    var NS = "http://www.w3.org/2000/svg", ROW = 8;
    var layer = document.createElement("div");
    layer.className = "t-voyage";
    layer.setAttribute("aria-hidden", "true");
    layer.innerHTML = '<svg class="v-trail"><defs><clipPath id="vclip"><rect x="0" y="0" width="100%" height="0"/></clipPath></defs>' +
      '<g clip-path="url(#vclip)"></g></svg>' +
      '<svg class="v-boat" viewBox="-8 -16 16 32"><path class="hull" d="M-5.5,-12 L-5.5,7 Q-2,15 0,16 Q2,15 5.5,7 L5.5,-12 Q0,-14 -5.5,-12Z"/>' +
      '<rect class="deck" x="-3" y="-6" width="6" height="9" rx="1.5"/></svg>';
    document.body.appendChild(layer);
    var trail = layer.querySelector(".v-trail"), group = trail.querySelector("g"),
      clip = trail.querySelector("rect"), boat = layer.querySelector(".v-boat");
    var rows = [], y0 = 0, y1 = 0, cx = 0, amp = 0, ready = false;

    function laneX(y) { return cx + amp * Math.sin(y / 260); }
    function darkAt(el) {
      for (var e = el; e && e !== document.documentElement; e = e.parentElement) {
        if (e.dataset && e.dataset.surface) return e.dataset.surface === "dark";
        var cs = getComputedStyle(e);
        if (/url\(/.test(cs.backgroundImage)) return true;
        var m = cs.backgroundColor.match(/[\d.]+/g);
        if (m && (m[3] === undefined || +m[3] > 0.5)) return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) < 128;
      }
      return false;
    }
    // every box that counts as content: text runs, media, controls, photo backgrounds
    function contentRects(top, bottom) {
      var out = [], sy = scrollY;
      var push = function (r) { if (r.width > 1 && r.height > 1) out.push([r.left, r.right, r.top + sy, r.bottom + sy]); };
      var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
        return n.nodeValue.trim() && !layer.contains(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; } });
      var range = document.createRange(), n;
      while ((n = w.nextNode())) {
        var p = n.parentElement;
        if (!p || p.closest("#nav, .wa, .t-sbar, #cb-consent, script, style, noscript")) continue;
        range.selectNodeContents(n);
        var rs = range.getClientRects();
        for (var i = 0; i < rs.length; i++) push(rs[i]);
      }
      document.querySelectorAll("img, video, picture, iframe, canvas, button, input, select, textarea, a, svg, [style*='url('], .t-map, .chip, .pill").forEach(function (el) {
        if (layer.contains(el) || el.closest("#nav, .wa, .t-sbar, #cb-consent")) return;
        var cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) return;
        push(el.getBoundingClientRect());
      });
      // a strip that runs past the screen edge (reviews marquee, chip rows) moves
      // or scrolls sideways: it blocks the lane for its whole height
      var vw = document.documentElement.clientWidth;
      out = out.map(function (r) { return (r[1] > vw + 1 || r[0] < -1) ? [0, vw, r[2], r[3]] : r; });
      return out.filter(function (r) { return r[3] > top && r[2] < bottom; });
    }

    function measure() {
      var docW = document.documentElement.clientWidth, sy = scrollY;
      var phone = docW < 600;
      cx = docW - (phone ? 8 : 16);
      amp = phone ? 1 : 5;
      var half = (phone ? 3.8 : 5.5) + amp + (phone ? 1 : 1.5);   // beam plus sway plus a breath of clearance
      var hb = hero.getBoundingClientRect();
      y0 = hb.bottom + sy + 40;
      var end = document.querySelector("section.reserve") || document.querySelector("footer");
      y1 = end ? end.getBoundingClientRect().top + sy + Math.min(end.offsetHeight * 0.45, 260) : y0;
      if (end && end.matches("footer")) y1 = end.getBoundingClientRect().top + sy - 20;
      var rects = contentRects(y0, y1), x0 = cx - half, x1 = cx + half;
      rects = rects.filter(function (r) { return r[1] > x0 && r[0] < x1; });
      rows = [];
      for (var y = y0; y < y1; y += ROW) {
        var free = true;
        for (var i = 0; i < rects.length; i++) if (rects[i][2] < y + ROW + 14 && rects[i][3] > y - 14) { free = false; break; }
        rows.push({ y: y, free: free, dark: false });
      }
      // surface colour, sampled per row from the element under the lane
      var probeX = Math.min(docW - 2, cx);
      layer.style.display = "none";
      rows.forEach(function (r) {
        if (!r.free) return;
        var vy = r.y - sy;
        if (vy >= 0 && vy < innerHeight) { var el = document.elementFromPoint(probeX, vy); r.dark = el ? darkAt(el) : false; }
        else r.dark = null;
      });
      layer.style.display = "";
      // rows off screen: take the surface from the section that spans them
      var secs = Array.prototype.slice.call(document.querySelectorAll("body > section, main > section, body > header, body > footer")).map(function (s) {
        var b = s.getBoundingClientRect(); return { top: b.top + sy, bot: b.bottom + sy, dark: darkAt(s) };
      });
      rows.forEach(function (r) {
        if (r.dark !== null) return;
        for (var i = 0; i < secs.length; i++) if (r.y >= secs[i].top && r.y < secs[i].bot) { r.dark = secs[i].dark; return; }
        r.dark = false;
      });
      // wake segments: break wherever the lane is taken or the surface changes
      var h = document.documentElement.scrollHeight;
      layer.style.height = Math.min(h, y1 + 40) + "px";
      trail.setAttribute("width", docW); trail.setAttribute("height", Math.min(h, y1 + 40));
      group.innerHTML = "";
      var d = "", dark = null;
      function flush() { if (d) { var pth = document.createElementNS(NS, "path"); pth.setAttribute("d", d); if (dark) pth.setAttribute("class", "dk"); group.appendChild(pth); } d = ""; }
      rows.forEach(function (r) {
        if (!r.free) { flush(); return; }
        if (dark !== r.dark) { flush(); dark = r.dark; }
        d += (d ? " L" : "M") + laneX(r.y).toFixed(1) + "," + r.y.toFixed(0);
      });
      flush();
      ready = rows.length > 0;
      place();
    }

    function place() {
      if (!ready) return;
      var by = Math.max(y0, Math.min(y1, scrollY + innerHeight * 0.55));
      clip.setAttribute("height", Math.max(0, by - 14));
      var r = rows[Math.min(rows.length - 1, Math.max(0, Math.floor((by - y0) / ROW)))];
      var tilt = Math.cos(by / 260) * amp / 260 * 57.3;   // follow the sway
      boat.style.transform = "translate(" + laneX(by).toFixed(1) + "px," + by.toFixed(1) + "px) rotate(" + (-tilt).toFixed(1) + "deg)";
      boat.classList.toggle("dk", !!r.dark);
      boat.classList.toggle("hide", !r.free || by <= y0 + 1);
    }

    var mt = 0;
    function remeasure() { clearTimeout(mt); mt = setTimeout(measure, 120); }
    onScroll(place);
    addEventListener("resize", remeasure);
    addEventListener("load", remeasure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
    if (window.ResizeObserver) new ResizeObserver(remeasure).observe(document.body);
    measure();
  })();

  /* ---------------------------------------- phone gallery: counter and arrows
     On phones the gallery is a swipe rail (tide.css .t-gal); the counter and
     the two buttons make "there is more" obvious and give a non-swipe way. */
  $$(".t-gal .gal").forEach(function (g) {
    var tiles = g.children, n = tiles.length;
    if (n < 2) return;
    var nav = document.createElement("div");
    nav.className = "gal-nav";
    nav.innerHTML = '<span class="gn-n" aria-live="polite">1 / ' + n + '</span><span class="gn-b">' +
      '<button type="button" class="gn-p" aria-label="' + (g.getAttribute("data-gal-prev") || "Previous photo") + '"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg></button>' +
      '<button type="button" class="gn-x" aria-label="' + (g.getAttribute("data-gal-next") || "Next photo") + '"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg></button></span>';
    g.parentNode.insertBefore(nav, g.nextSibling);
    var num = nav.querySelector(".gn-n"), prev = nav.querySelector(".gn-p"), next = nav.querySelector(".gn-x");
    function at() {
      var x = g.scrollLeft + 1, w = tiles[0].getBoundingClientRect().width + 10;
      return Math.max(0, Math.min(n - 1, Math.round(x / w)));
    }
    function sync() {
      var i = at(), end = g.scrollLeft + g.clientWidth >= g.scrollWidth - 4;
      if (end) i = n - 1;
      num.textContent = (i + 1) + " / " + n;
      prev.disabled = i === 0; next.disabled = i === n - 1;
    }
    function go(d) {
      var i = Math.max(0, Math.min(n - 1, at() + d));
      g.scrollTo({ left: g.scrollLeft + tiles[i].getBoundingClientRect().left - g.getBoundingClientRect().left - parseFloat(getComputedStyle(g).paddingLeft || 0), behavior: REDUCE ? "auto" : "smooth" });
    }
    prev.addEventListener("click", function () { go(-1); });
    next.addEventListener("click", function () { go(1); });
    var st = 0;
    g.addEventListener("scroll", function () { cancelAnimationFrame(st); st = requestAnimationFrame(sync); }, { passive: true });
    sync();
  });

  /* ---------------------------------------- phone menu: keyboard focus
     Open: focus moves to the first link. Escape or the button closes it and
     focus returns to the menu button (peak.js does the opening and locking). */
  (function () {
    var tog = document.querySelector(".navtoggle"), nl = document.querySelector(".nl");
    if (!tog || !nl) return;
    var was = false;
    new MutationObserver(function () {
      var open = nl.classList.contains("open");
      if (open && !was) { var a = nl.querySelector("a"); if (a) setTimeout(function () { a.focus({ preventScroll: true }); }, 60); }
      if (!open && was && nl.contains(document.activeElement)) tog.focus({ preventScroll: true });
      was = open;
    }).observe(nl, { attributes: true, attributeFilter: ["class"] });
  })();

  /* ---------------------------------------- trip cards: details open on wide screens */
  (function () {
    var ds = $$(".t-more");
    if (!ds.length || !window.matchMedia) return;
    var mq = matchMedia("(min-width:761px)");
    var set = function () { ds.forEach(function (d) { if (mq.matches) d.open = true; else if (!d.dataset.user) d.open = false; }); };
    ds.forEach(function (d) { d.querySelector("summary").addEventListener("click", function () { d.dataset.user = "1"; }); });
    set();
    if (mq.addEventListener) mq.addEventListener("change", set);
  })();
})();
