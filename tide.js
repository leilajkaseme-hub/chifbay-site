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
    var hero = document.querySelector(".hero .hbg, .bkhero .bkhbg, .hero, main img, article img");
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
      '<path class="sea-bg" d="' + d + '"/><path class="sea-fg" d="' + d + '"/>' + marks + "</svg>";
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
    function paint(k) {
      fg.style.strokeDashoffset = (L * (1 - k)).toFixed(1);
      at.forEach(function (v, j) {
        var on = k >= v - 0.01;
        pins[j].classList.toggle("on", on);
        stops[j].classList.toggle("on", on);
      });
    }
    if (REDUCE) { paint(1); return; }
    var active = false;
    inView(sec, function (v) { active = v; if (v) runScroll(); });
    onScroll(function () {
      if (!active) return;
      var r = sec.getBoundingClientRect(), vh = innerHeight;
      // 0 when the block's top meets the bottom of the screen, 1 when its
      // bottom reaches 70% of the screen height
      var k = (vh - r.top) / (r.height + vh * 0.3);
      paint(Math.min(1, Math.max(0, k)));
    });
    paint(0);
    runScroll();
  });

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
})();
