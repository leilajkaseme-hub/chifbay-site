// Chifbay — shared interactions
(function(){
  var nav=document.getElementById('nav');
  function onScroll(){ if(nav) nav.classList.toggle('sc', window.scrollY>60); }
  window.addEventListener('scroll',onScroll,{passive:true}); onScroll();

  var tog=document.querySelector('.navtoggle'), nl=document.querySelector('.nl');
  if(tog&&nl){
    var setNav=function(open){
      nl.classList.toggle('open',open);
      document.documentElement.classList.toggle('nav-open',open);   // locks background scroll + morphs the icon
      tog.setAttribute('aria-expanded',String(open));
    };
    tog.setAttribute('aria-expanded','false');
    tog.addEventListener('click',function(){ setNav(!nl.classList.contains('open')); });
    nl.querySelectorAll('a').forEach(function(a){ a.addEventListener('click',function(){ setNav(false); }); });
    document.addEventListener('keydown',function(e){ if(e.key==='Escape') setNav(false); });
  }

  /* The gold CTA also belongs inside the open drawer — the pill in the bar is
     deliberately tiny, and a menu you have just opened is exactly where a big
     obvious "book" belongs. Cloned before the pill's label is shortened, so
     this copy keeps the full wording. Self-links (#exp on the experiences
     page, #bkbox on the booking pages) are skipped: you are already there. */
  var cta=document.querySelector('#nav .nc');
  if(cta&&nl&&!nl.querySelector('.nc-drawer')&&(cta.getAttribute('href')||'').charAt(0)!=='#'){
    var c=cta.cloneNode(true);
    c.className='nc-drawer';
    nl.appendChild(c);
    c.addEventListener('click',function(){ if(tog) tog.click(); });
  }

  var io=new IntersectionObserver(function(es){
    es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
  },{threshold:.1,rootMargin:'0px 0px -36px 0px'});
  document.querySelectorAll('.rv:not(.in)').forEach(function(el){ io.observe(el); });

  var y=document.getElementById('yr'); if(y) y.textContent=new Date().getFullYear();
})();

/* THEME — light / dark.
   The <head> snippet has already put the right value on <html> before the
   first paint. This only wires the footer control and remembers the choice. */
(function(){
  var KEY='cb-theme';
  function current(){ return document.documentElement.getAttribute('data-theme')==='light'?'light':'dark'; }
  function apply(t){
    document.documentElement.setAttribute('data-theme',t);
    try{ localStorage.setItem(KEY,t); }catch(e){}
    document.querySelectorAll('.themetog button').forEach(function(b){
      b.setAttribute('aria-pressed',String(b.dataset.theme===t));
    });
  }
  document.querySelectorAll('.themetog button').forEach(function(b){
    b.addEventListener('click',function(){ apply(b.dataset.theme); });
  });
  apply(current());
})();

(function(){
  var LL=["fr","de","pt","es","it"];
  var NAMES={en:"English",fr:"Français",de:"Deutsch",pt:"Português",es:"Español",it:"Italiano"};
  // Regional-indicator pairs. Windows has no flag glyphs and falls back to the
  // two letters (GB, FR…), which still reads correctly.
  var FLAGS={en:"\uD83C\uDDEC\uD83C\uDDE7",fr:"\uD83C\uDDEB\uD83C\uDDF7",
             de:"\uD83C\uDDE9\uD83C\uDDEA",pt:"\uD83C\uDDF5\uD83C\uDDF9",
             es:"\uD83C\uDDEA\uD83C\uDDF8",it:"\uD83C\uDDEE\uD83C\uDDF9"};

  /* Most pages carry the switcher in their markup, but the blog posts, the
     booking pages, 404 and a few locale pages never did — 85 of 133. Rather
     than paste the same block into each file, build it here when it is
     missing. Links come from the page's own hreflang alternates when it has
     them, and otherwise from each language's home page. */
  function buildLangsel(){
    if(document.querySelector(".langsel")) return;
    var nav=document.getElementById("nav"); if(!nav) return;
    var alts={};
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(function(l){
      var h=l.getAttribute("hreflang");
      if(h && h!=="x-default") alts[h]=l.getAttribute("href");
    });
    var items="";
    ["en"].concat(LL).forEach(function(l){
      var href=alts[l] || (l==="en" ? "/" : "/"+l+"/index.html");
      items+='<a href="'+href+'">'+NAMES[l]+"</a>";
    });
    var box=document.createElement("div");
    box.className="langsel";
    box.innerHTML='<button class="langbtn" title="Language" aria-label="Language">'+
      '<span class="langglobe" aria-hidden="true">\uD83C\uDF10</span> <span class="langcode">EN</span> '+
      '<span class="langcaret" aria-hidden="true">\u25BE</span></button>'+
      '<div class="langmenu">'+items+"</div>";
    var host=nav.querySelector(".ni > div:last-child") || nav.querySelector(".ni") || nav;
    host.insertBefore(box, host.firstChild);
  }
  buildLangsel();

  /* On a phone the switcher belongs in the slide-out menu, with the other
     navigation, not floating over the hero. The "book" pill solves the same
     problem with a clone, but that will not work here: peak.js finds this
     control with querySelector(".langsel") to wire its open/close, and a second
     copy would leave that wired to the wrong one. So the single node moves
     between the top bar and the drawer, and moves back if the window grows (a
     tablet turned landscape, a resized desktop window).
     This replaces an earlier block that moved the same node out to <body> so it
     could float; that is gone, and with it the reason it had to leave #nav. */
  (function(){
    var ls = document.querySelector(".langsel");
    var drawer = document.querySelector(".nl");
    if(!ls || !drawer) return;
    var home = ls.parentNode, after = ls.nextSibling;
    var mq = matchMedia("(max-width:860px)");
    function place(){
      if(mq.matches){ if(ls.parentNode !== drawer) drawer.appendChild(ls); }
      else if(ls.parentNode !== home){ home.insertBefore(ls, after); }
      ls.classList.remove("open");
    }
    place();
    if(mq.addEventListener) mq.addEventListener("change", place);
    else if(mq.addListener) mq.addListener(place);
  })();

  function langOf(href){var s=(href||"").split("/").filter(Boolean);return LL.indexOf(s[0])>=0?s[0]:"en";}
  function pageFile(){var f=location.pathname.split("/").pop();return f||"index.html";}
  var p=location.pathname.split("/").filter(Boolean);
  var lang=(LL.indexOf(p[0])>=0)?p[0]:"en";
  var cb=document.querySelector(".langcode"); if(cb) cb.textContent=lang.toUpperCase();
  // The floating circle on phones shows the flag, not the letters (owner's call).
  var btn0=document.querySelector(".langbtn");
  if(btn0){
    // the hand-written markup has bare <span>s: the globe first, the caret last
    var bare=[].filter.call(btn0.querySelectorAll("span"),function(x){return !x.className;});
    if(bare[0]) bare[0].className="langglobe";
    if(bare[bare.length-1]) bare[bare.length-1].className="langcaret";
  }
  if(btn0 && !btn0.querySelector(".langflag")){
    var fl=document.createElement("span");
    fl.className="langflag"; fl.setAttribute("aria-hidden","true");
    fl.textContent=FLAGS[lang]||FLAGS.en;
    btn0.insertBefore(fl, btn0.firstChild);
  }
  var menu=document.querySelectorAll(".langmenu a");
  menu.forEach(function(a){
    var al=langOf(a.getAttribute("href"));
    if(!a.querySelector(".langflag")){
      var f=document.createElement("span");
      f.className="langflag"; f.setAttribute("aria-hidden","true");
      f.textContent=FLAGS[al]||"";
      a.insertBefore(f, a.firstChild);
    }
    if(al===lang) a.classList.add("on");
    a.addEventListener("click",function(){ try{localStorage.setItem("chifbay_lang", langOf(a.getAttribute("href")));}catch(e){} });
  });
  /* "Book your boat" is far too wide for a pill sitting next to a centred
     logo, so on phones it shortens to one word. The copy in the drawer, and
     the desktop bar, keep the full wording. */
  var SHORT={en:"Book",fr:"Réserver",de:"Buchen",pt:"Reservar",es:"Reservar",it:"Prenota"};
  var nc=document.querySelector("#nav .nc");
  if(nc&&window.matchMedia){
    var full=nc.textContent.trim(), mqs=window.matchMedia("(max-width:860px)");
    var label=function(){ nc.textContent = mqs.matches ? (SHORT[lang]||SHORT.en) : full; };
    label();
    if(mqs.addEventListener) mqs.addEventListener("change",label);
    else if(mqs.addListener) mqs.addListener(label);
  }

  var ls=document.querySelector(".langsel"), btn=ls&&ls.querySelector(".langbtn");
  if(btn){ btn.addEventListener("click",function(e){
      e.stopPropagation();
      var opened = ls.classList.toggle("open");
      /* In the drawer the list opens downward and, on a short screen, below the
         fold. The drawer scrolls, but nothing tells you to. Bring it into view. */
      if(opened && ls.closest(".nl")){
        setTimeout(function(){ ls.scrollIntoView({block:"nearest",behavior:"smooth"}); },0);
      }
    });
    document.addEventListener("click",function(){ls.classList.remove("open");}); }
  fetch("/i18n-langs.json").then(function(r){return r.json();}).then(function(av){
    menu.forEach(function(a){ var l=langOf(a.getAttribute("href")); if(av.indexOf(l)<0){ a.style.opacity=".35"; a.style.pointerEvents="none"; } });
    var chosen=null; try{chosen=localStorage.getItem("chifbay_lang");}catch(e){}
    if(lang==="en" && !chosen){
      var nl=((navigator.languages&&navigator.languages[0])||navigator.language||"en").slice(0,2).toLowerCase();
      if(nl!=="en" && av.indexOf(nl)>=0){
        try{localStorage.setItem("chifbay_lang",nl);}catch(e){}
        // i18n-langs.json only says the LANGUAGE exists somewhere on the site,
        // not that THIS page has a translated copy — the three booking pages
        // are deliberately English-only. A blind redirect 404s for anyone
        // whose first visit ever lands there with a non-English browser
        // (a French ad click straight onto book-sunset.html, for instance).
        // One HEAD check, only on this first-ever visit, before committing.
        var target="/"+nl+"/"+pageFile();
        fetch(target,{method:"HEAD"}).then(function(r){ if(r.ok) location.replace(target); }).catch(function(){});
      }
    }
  }).catch(function(){});
})();

