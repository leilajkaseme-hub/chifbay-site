/*! Chifbay tracking — one file for chifbay.com and book.chifbay.com.
 *
 *  What it does:
 *   1. Loads GA4 and the Meta pixel (only if an ID is set below).
 *   2. Saves the ad click id (gclid / fbclid / utm) in a cookie on .chifbay.com
 *      and adds it to every link that goes to the Wix booking site.
 *   3. Fires the funnel events: booking click, WhatsApp click, email, phone.
 *   4. Asks for consent first (EU law), and tells Google what was allowed.
 *
 *  Why the cookie works: chifbay.com and book.chifbay.com share the same root
 *  domain, so a cookie written on ".chifbay.com" is readable on both. Two
 *  different domains would need a linker. This does not.
 *
 *  ---------------------------------------------------------------------------
 *  TO TURN IT ON: put your two IDs in CFG below. That is the only edit needed.
 *  An empty ID means that platform stays off and makes no network call.
 *  ---------------------------------------------------------------------------
 */
(function () {
  "use strict";

  var CFG = {
    GA4_ID: "",              // "G-XXXXXXXXXX"  — Google Analytics 4, not created yet
    META_PIXEL_ID: "",       // "1234567890123" — Meta (Facebook/Instagram) pixel
    GOOGLE_ADS_ID: "AW-18236394775",  // Google Ads 101-842-4407, tag GT-T9BH5NKD

    // The "Achat" conversion action. The booking finishes on the Wix site, so
    // this is fired there — see wix-custom-code.html, which reads it from here
    // so the id and the label only ever live in one file.
    ADS_PURCHASE_LABEL: "-K9yCPXlqr4cEJea5fdD",

    COOKIE_DOMAIN: ".chifbay.com",
    BOOKING_HOST: "book.chifbay.com",
    ATTR_DAYS: 90,           // how long we remember which ad brought them
    CONSENT_BANNER: true,    // false = no banner (only legal outside the EU)
    DEBUG: false             // true = log every event to the console
  };

  // Price floor per tour, used as the event value so the ad platforms can
  // optimise on money and not just on clicks. Matches the offers in the
  // page schema: sunset from EUR 400, day trip from EUR 500.
  var TOUR_VALUE = {
    "private-sunset-cruise": { value: 400, name: "Sunset Trip" },
    "private-luxury-boat-tour-madeira": { value: 500, name: "Day Trip" }
  };

  var ATTR_COOKIE = "cb_attr";
  var CONSENT_COOKIE = "cb_consent";
  var CLICK_IDS = ["gclid", "gbraid", "wbraid", "fbclid", "msclkid", "ttclid"];
  var UTMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
  var PASS_THROUGH = CLICK_IDS.concat(UTMS);

  function log() {
    if (CFG.DEBUG && window.console) console.log.apply(console, ["[cb]"].concat([].slice.call(arguments)));
  }

  /* ---------------------------------------------------------------- cookies */

  function readCookie(name) {
    var m = document.cookie.match("(^|; )" + name + "=([^;]*)");
    return m ? decodeURIComponent(m[2]) : null;
  }

  function writeCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + days * 864e5);
    // Fall back to a host-only cookie when running somewhere else (localhost,
    // a preview URL): a cookie for .chifbay.com would simply be dropped.
    var domain = location.hostname.indexOf("chifbay.com") !== -1
      ? "; domain=" + CFG.COOKIE_DOMAIN
      : "";
    document.cookie = name + "=" + encodeURIComponent(value) +
      "; expires=" + d.toUTCString() + "; path=/" + domain +
      "; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : "");
  }

  /* ------------------------------------------------------------ attribution */

  function currentParams() {
    var q = new URLSearchParams(location.search);
    var out = {};
    PASS_THROUGH.forEach(function (k) {
      var v = q.get(k);
      if (v) out[k] = v;
    });
    return out;
  }

  function loadAttr() {
    try { return JSON.parse(readCookie(ATTR_COOKIE) || "{}"); } catch (e) { return {}; }
  }

  // Work out who sent this visitor, in memory only.
  // Keep the first touch forever, refresh the last touch whenever a new ad
  // click arrives. A plain visit with no parameters never wipes what we have —
  // that is the usual way attribution gets lost.
  function computeAttr() {
    var found = currentParams();
    var stored = loadAttr();

    PASS_THROUGH.forEach(function (k) { if (found[k]) stored[k] = found[k]; });
    if (!stored.first_seen) {
      stored.first_seen = new Date().toISOString();
      stored.landing = location.pathname;
      if (document.referrer) stored.referrer = document.referrer;
    }
    if (Object.keys(found).length) stored.last_seen = new Date().toISOString();
    return stored;
  }

  var ATTR = computeAttr();

  // This is an advertising cookie, so it is only written once the visitor has
  // accepted. Until then the click id lives in memory and rides along in the
  // link instead — see decorateAll(). Same idea as Google's url passthrough.
  function persistAttr() {
    writeCookie(ATTR_COOKIE, JSON.stringify(ATTR), CFG.ATTR_DAYS);
    log("attribution saved", ATTR);
  }

  /* --------------------------------------------------------------- consent */

  function storedConsent() {
    var v = readCookie(CONSENT_COOKIE);
    return v === "granted" || v === "denied" ? v : null;
  }

  function pushConsent(state) {
    var granted = state === "granted" ? "granted" : "denied";
    if (window.gtag) {
      gtag("consent", "update", {
        ad_storage: granted,
        ad_user_data: granted,
        ad_personalization: granted,
        analytics_storage: granted
      });
    }
    if (window.fbq) fbq("consent", granted === "granted" ? "grant" : "revoke");
    log("consent", granted);
  }

  function setConsent(state) {
    writeCookie(CONSENT_COOKIE, state, 180);
    pushConsent(state);
    if (state === "granted") { persistAttr(); decorateAll(); }
  }

  /* ------------------------------------------------------- tag loading */

  function loadScript(src) {
    var s = document.createElement("script");
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  }

  function bootGoogle() {
    if (!CFG.GA4_ID && !CFG.GOOGLE_ADS_ID) return;

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };

    // Denied by default, before anything loads. Required in the EEA.
    gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
      wait_for_update: 500
    });

    gtag("js", new Date());
    // cookie_domain pins the cookie to the root so the Wix booking subdomain
    // reads the same visitor. "auto" usually does this, but not always behind
    // a proxy, and a wrong cookie here silently splits every session in two.
    var opts = { cookie_domain: "chifbay.com", cookie_flags: "SameSite=Lax;Secure" };
    if (CFG.GA4_ID) gtag("config", CFG.GA4_ID, opts);
    if (CFG.GOOGLE_ADS_ID) gtag("config", CFG.GOOGLE_ADS_ID, opts);

    loadScript("https://www.googletagmanager.com/gtag/js?id=" + (CFG.GA4_ID || CFG.GOOGLE_ADS_ID));
  }

  function bootMeta() {
    if (!CFG.META_PIXEL_ID) return;

    /* eslint-disable */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    /* eslint-enable */

    // Meta has no consent mode, so revoke first and grant only on accept.
    fbq("consent", "revoke");
    fbq("init", CFG.META_PIXEL_ID);
    fbq("track", "PageView");
  }

  bootGoogle();
  bootMeta();

  var known = storedConsent();
  if (known) pushConsent(known);
  else if (!CFG.CONSENT_BANNER) pushConsent("granted");
  if (known === "granted" || !CFG.CONSENT_BANNER) persistAttr();

  /* ----------------------------------------------------------- the banner */

  function buildBanner() {
    if (!CFG.CONSENT_BANNER || storedConsent()) return;
    if (!CFG.GA4_ID && !CFG.META_PIXEL_ID && !CFG.GOOGLE_ADS_ID) return; // nothing to consent to

    var lang = (document.documentElement.lang || "en").slice(0, 2);
    var T = {
      en: ["We use cookies to measure our ads. Nothing else.", "Accept", "Decline", "Privacy"],
      fr: ["Nous utilisons des cookies pour mesurer nos publicités. Rien d'autre.", "Accepter", "Refuser", "Confidentialité"],
      de: ["Wir nutzen Cookies, um unsere Werbung zu messen. Sonst nichts.", "Akzeptieren", "Ablehnen", "Datenschutz"],
      pt: ["Usamos cookies para medir os nossos anúncios. Nada mais.", "Aceitar", "Recusar", "Privacidade"],
      es: ["Usamos cookies para medir nuestros anuncios. Nada más.", "Aceptar", "Rechazar", "Privacidad"],
      it: ["Usiamo i cookie per misurare i nostri annunci. Nient'altro.", "Accetta", "Rifiuta", "Privacy"]
    };
    var t = T[lang] || T.en;
    // Absolute: this same file also runs on the Wix booking subdomain, which
    // has no privacy page of its own.
    var privacyHref = "https://chifbay.com" + (lang === "en" ? "/privacy.html" : "/" + lang + "/privacy.html");

    var bar = document.createElement("div");
    bar.id = "cb-consent";
    bar.setAttribute("role", "dialog");
    bar.setAttribute("aria-label", t[0]);
    bar.style.cssText = [
      "position:fixed", "left:16px", "right:16px", "bottom:16px", "z-index:9999",
      "max-width:640px", "margin:0 auto", "padding:16px 18px",
      "background:rgba(12,16,20,.94)", "backdrop-filter:blur(10px)",
      "color:#f2f4f6", "border:1px solid rgba(255,255,255,.14)", "border-radius:14px",
      "font:400 14px/1.45 Inter,system-ui,sans-serif",
      "display:flex", "flex-wrap:wrap", "gap:12px", "align-items:center",
      "justify-content:space-between", "box-shadow:0 12px 40px rgba(0,0,0,.35)"
    ].join(";");

    var text = document.createElement("span");
    text.style.cssText = "flex:1 1 240px";
    text.appendChild(document.createTextNode(t[0] + " "));
    var link = document.createElement("a");
    link.href = privacyHref;
    link.textContent = t[3];
    link.style.cssText = "color:#9ad0ff;text-decoration:underline";
    text.appendChild(link);

    var btns = document.createElement("span");
    btns.style.cssText = "display:flex;gap:8px;flex:0 0 auto";

    function button(label, primary, onClick) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.style.cssText = "cursor:pointer;border-radius:999px;padding:9px 18px;font:500 14px Inter,system-ui,sans-serif;" +
        (primary
          ? "background:#f2f4f6;color:#0c1014;border:0"
          : "background:transparent;color:#cfd6dd;border:1px solid rgba(255,255,255,.22)");
      b.addEventListener("click", onClick);
      return b;
    }

    btns.appendChild(button(t[2], false, function () { setConsent("denied"); bar.remove(); }));
    btns.appendChild(button(t[1], true, function () {
      setConsent("granted");
      bar.remove();
      if (window.fbq) fbq("track", "PageView"); // the first one ran without consent
    }));

    bar.appendChild(text);
    bar.appendChild(btns);
    document.body.appendChild(bar);
  }

  // Let the privacy page offer "change my choice".
  window.cbConsent = {
    set: setConsent,
    get: storedConsent,
    reopen: function () {
      writeCookie(CONSENT_COOKIE, "", -1);
      var old = document.getElementById("cb-consent");
      if (old) old.remove();
      buildBanner();
    }
  };

  /* ------------------------------------------------------------- events */

  function fire(gaName, metaName, params) {
    params = params || {};
    if (window.gtag && (CFG.GA4_ID || CFG.GOOGLE_ADS_ID)) gtag("event", gaName, params);
    if (window.fbq && CFG.META_PIXEL_ID) {
      var standard = ["Contact", "InitiateCheckout", "Lead", "Purchase", "ViewContent", "Schedule"];
      var method = standard.indexOf(metaName) !== -1 ? "track" : "trackCustom";
      fbq(method, metaName, {
        value: params.value,
        currency: params.currency,
        content_name: params.item_name
      });
    }
    log("event", gaName, params);
  }
  window.cbTrack = fire;

  // Read-only, for the Wix snippet: it needs the Google Ads id and the
  // conversion label, and must not carry its own copy of them.
  window.cbCfg = {
    googleAdsId: CFG.GOOGLE_ADS_ID,
    adsPurchaseLabel: CFG.ADS_PURCHASE_LABEL,
    ga4Id: CFG.GA4_ID,
    metaPixelId: CFG.META_PIXEL_ID
  };

  /* ---------------------------------------------- carry the id to the Wix */

  function withAttr(url, keys, onlyHost) {
    try {
      var u = new URL(url, location.href);
      if (onlyHost && u.hostname !== onlyHost) return null;
      keys.forEach(function (k) {
        if (ATTR[k] && !u.searchParams.has(k)) u.searchParams.set(k, ATTR[k]);
      });
      return u.toString();
    } catch (e) { return null; }
  }

  var decorate = function (url) { return withAttr(url, PASS_THROUGH, CFG.BOOKING_HOST); };

  function decorateAll() {
    var links = document.querySelectorAll('a[href*="' + CFG.BOOKING_HOST + '"]');
    for (var i = 0; i < links.length; i++) {
      var next = decorate(links[i].getAttribute("href"));
      if (next) links[i].setAttribute("href", next);
    }
    log("decorated", links.length, "booking links");

    // No consent yet means nothing may be stored on this device, so the click
    // id has to ride in the links or it dies on the next page. Once the
    // visitor accepts, the cookie takes over and this stops.
    if (storedConsent() === "granted") return;
    var hasClickId = CLICK_IDS.some(function (k) { return !!ATTR[k]; });
    if (!hasClickId) return;

    var all = document.querySelectorAll('a[href]');
    for (var j = 0; j < all.length; j++) {
      var href = all[j].getAttribute("href") || "";
      if (/^(#|mailto:|tel:|javascript:)/i.test(href)) continue;
      var internal = withAttr(href, CLICK_IDS, location.hostname);
      if (internal) all[j].setAttribute("href", internal);
    }
  }

  function tourFromHref(href) {
    for (var slug in TOUR_VALUE) {
      if (href.indexOf(slug) !== -1) return TOUR_VALUE[slug];
    }
    return { value: undefined, name: "Boat tour" };
  }

  function onClick(e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";

    if (href.indexOf(CFG.BOOKING_HOST) !== -1) {
      // Late-added links (or ones a script rewrote) still get the click id.
      var next = decorate(href);
      if (next && next !== href) a.setAttribute("href", next);
      var tour = tourFromHref(href);
      fire("begin_checkout", "InitiateCheckout", {
        currency: "EUR", value: tour.value, item_name: tour.name
      });
      return;
    }
    if (href.indexOf("wa.me/") !== -1 || href.indexOf("api.whatsapp.com") !== -1) {
      fire("contact_whatsapp", "Contact", { method: "whatsapp" });
      return;
    }
    if (href.indexOf("mailto:") === 0) { fire("contact_email", "Contact", { method: "email" }); return; }
    if (href.indexOf("tel:") === 0) { fire("contact_phone", "Contact", { method: "phone" }); }
  }

  function start() {
    decorateAll();
    buildBanner();
    document.addEventListener("click", onClick, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
