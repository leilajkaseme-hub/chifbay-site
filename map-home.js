/* Chifbay — homepage marina map, custom aesthetic interactive map.
   Zero keyboard shortcuts, zero cluttered POIs, customized luxury styling
   with automatic light/dark mode tile support and Pontão C golden beacon. */
(function () {
  var box = document.getElementById("mapBox");
  var stub = document.getElementById("mapStub");
  var btn = document.getElementById("mapLoad");
  if (!box) return;

  var LANG = (document.documentElement.lang || "en").slice(0, 2);
  var I18N = {
    en: { tag: "Marina do Funchal", sub: "Pontoon C · Chifbay", btn: "Open in Google Maps" },
    fr: { tag: "Marina do Funchal", sub: "Ponton C · Chifbay", btn: "Ouvrir dans Google Maps" },
    de: { tag: "Marina do Funchal", sub: "Steg C · Chifbay", btn: "In Google Maps öffnen" },
    pt: { tag: "Marina do Funchal", sub: "Pontão C · Chifbay", btn: "Abrir no Google Maps" },
    es: { tag: "Marina do Funchal", sub: "Pontón C · Chifbay", btn: "Abrir en Google Maps" },
    it: { tag: "Marina do Funchal", sub: "Pontile C · Chifbay", btn: "Apri in Google Maps" }
  }[LANG] || { tag: "Marina do Funchal", sub: "Pontoon C · Chifbay", btn: "Open in Google Maps" };

  var GM_URL = "https://www.google.com/maps/search/?api=1&query=Marina+do+Funchal%2C+Funchal%2C+Madeira";
  var COORDS = [32.6463, -16.9110]; // Pontão C, Marina do Funchal
  var loaded = false;

  function loadLeaflet(cb) {
    if (window.L) { cb(); return; }
    if (!document.getElementById("cbLeafletCss")) {
      var link = document.createElement("link");
      link.id = "cbLeafletCss";
      link.rel = "stylesheet";
      link.href = "/vendor/leaflet/leaflet.css";
      document.head.appendChild(link);
    }
    var script = document.createElement("script");
    script.src = "/vendor/leaflet/leaflet.js";
    script.onload = cb;
    document.head.appendChild(script);
  }

  function initMap() {
    if (loaded) return;
    loaded = true;

    loadLeaflet(function () {
      if (stub) stub.remove();

      var canvas = document.createElement("div");
      canvas.className = "cb-map-canvas";
      box.appendChild(canvas);

      var isDark = document.documentElement.getAttribute("data-theme") === "dark";
      var tileVoyager = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
      var tileDark    = "https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png";

      var map = L.map(canvas, {
        center: [32.6465, -16.9125],
        zoom: 15,
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: true
      });

      var currentTileLayer = L.tileLayer(isDark ? tileDark : tileVoyager, {
        subdomains: "abcd",
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>'
      }).addTo(map);

      // Listen to theme toggle changes to seamlessly swap tiles
      var obs = new MutationObserver(function () {
        var nowDark = document.documentElement.getAttribute("data-theme") === "dark";
        map.removeLayer(currentTileLayer);
        currentTileLayer = L.tileLayer(nowDark ? tileDark : tileVoyager, {
          subdomains: "abcd",
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>'
        }).addTo(map);
      });
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

      // Custom Luxury Pin on Pontão C
      var icon = L.divIcon({
        className: "cb-custom-marker-parent",
        html: '<div class="cb-marker-wrap">' +
                '<div class="cb-marker-pulse"></div>' +
                '<div class="cb-marker-pin">' +
                  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a5 5 0 0 0-5 5c0 3.5 5 9.5 5 9.5s5-6 5-9.5a5 5 0 0 0-5-5zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>' +
                '</div>' +
                '<div class="cb-marker-card">' +
                  '<strong>' + I18N.tag + '</strong>' +
                  '<span>' + I18N.sub + '</span>' +
                '</div>' +
              '</div>',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      var marker = L.marker(COORDS, { icon: icon }).addTo(map);
      marker.on("click", function () {
        window.open(GM_URL, "_blank", "noopener");
      });

      // Floating Direct Google Maps button
      var directBtn = document.createElement("a");
      directBtn.className = "cb-map-direct-btn";
      directBtn.href = GM_URL;
      directBtn.target = "_blank";
      directBtn.rel = "noopener";
      directBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>' + I18N.btn;
      box.appendChild(directBtn);

      // Invalidate size once visible
      setTimeout(function () { map.invalidateSize(); }, 200);
    });
  }

  if (btn) btn.addEventListener("click", initMap);

  // Load automatically once near viewport
  try {
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting; })) {
          io.disconnect();
          initMap();
        }
      }, { rootMargin: "300px" });
      io.observe(box);
    } else {
      initMap();
    }
  } catch (e) {
    if (btn) btn.addEventListener("click", initMap);
  }
})();
