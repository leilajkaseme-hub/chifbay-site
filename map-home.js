/* Chifbay — homepage marina map, loaded on demand. Added 2026-08-10.

   Google's embed writes its own cookies and the privacy policy promises that
   nothing loads before the visitor accepts, so the iframe is never in the
   page markup. It is injected when:
     - the visitor has already accepted cookies (window.cbConsent.get()), or
     - the visitor presses "Show the map".

   Pressing the button is itself the consent for this one frame, so it does not
   flip the site-wide cookie choice. */
(function () {
  var box = document.getElementById("mapBox");
  var stub = document.getElementById("mapStub");
  var btn = document.getElementById("mapLoad");
  if (!box || !stub || !btn) return;

  // Google shows the map UI in this language, so /fr/ gets a French map.
  var LANG = (document.documentElement.lang || "en").slice(0, 2);
  var SRC = "https://www.google.com/maps?q=Marina+do+Funchal%2C+9000-055+Funchal%2C+Portugal" +
            "&z=15&hl=" + encodeURIComponent(LANG) + "&output=embed";
  var loaded = false;

  function load() {
    if (loaded) return;
    loaded = true;
    var f = document.createElement("iframe");
    f.src = SRC;
    f.title = box.getAttribute("data-map-title") ||
      "Map showing Marina do Funchal, the departure point for Chifbay boat trips";
    f.loading = "lazy";
    f.referrerPolicy = "no-referrer-when-downgrade";
    f.setAttribute("allowfullscreen", "");
    box.appendChild(f);
    stub.remove();
  }

  btn.addEventListener("click", load);

  // Already accepted cookies on a previous page? Then show the map straight
  // away — but only once it is near the viewport, so it costs nothing to the
  // visitors who never scroll this far.
  try {
    if (window.cbConsent && window.cbConsent.get() === "granted") {
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (es) {
          if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); load(); }
        }, { rootMargin: "300px" });
        io.observe(box);
      } else {
        load();
      }
    }
  } catch (e) { /* the stub button still works */ }
})();
