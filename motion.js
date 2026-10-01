/* Chifbay — moteur d'animation au scroll.
   Se greffe sur le site existant : aucun markup n'est réécrit, seulement enrichi.
   Dégrade proprement : sans GSAP, ou en reduced-motion, peak.css révèle déjà tout. */
(function(){
  if(!window.gsap || !window.ScrollTrigger) return;
  var reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced) return;

  var q=new URLSearchParams(location.search);
  var SHOT=q.has('once');                       // capture headless : tout est posé, rien n'anime
  var fine=matchMedia('(hover:hover) and (pointer:fine)').matches;
  var MOBILE=innerWidth<900 || !fine;
  var html=document.documentElement;
  html.classList.add('mo');

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ignoreMobileResize:true});

  /* ---------------- chrome ----------------
     The old loader (logo, bar, a percentage that counted up at random) and the
     custom cursor are gone: tide.js owns the one page transition now, and its
     percentage follows real progress. Native cursor, native scroll. */

  /* ---------------- titres : révélation mot à mot ----------------
     On marche l'arbre pour garder <em>, <strong> et <br> intacts. */
  function splitWords(root){
    var out=[];
    (function walk(node){
      Array.prototype.slice.call(node.childNodes).forEach(function(n){
        if(n.nodeType===3){
          if(!n.textContent.trim()){ return; }
          var frag=document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function(p){
            if(!p) return;
            if(/^\s+$/.test(p)){ frag.appendChild(document.createTextNode(p)); return; }
            var w=document.createElement('span'); w.className='w';
            var i=document.createElement('span'); i.className='wi'; i.textContent=p;
            w.appendChild(i); frag.appendChild(w); out.push(i);
          });
          n.parentNode.replaceChild(frag,n);
        } else if(n.nodeType===1 && n.tagName!=='BR'){
          // Les <em> en dégradé (background-clip:text) ne survivent pas au découpage :
          // leurs mots hériteraient du texte transparent sans le dégradé. On anime l'élément entier.
          var cs=getComputedStyle(n);
          if(cs.webkitTextFillColor==='rgba(0, 0, 0, 0)' || cs.webkitTextFillColor==='transparent'){
            var box=document.createElement('span'); box.className='w';
            n.parentNode.replaceChild(box,n); box.appendChild(n);
            n.classList.add('wi'); n.style.display='inline-block';
            out.push(n);
          } else walk(n);
        }
      });
    })(root);
    return out;
  }

  var heads=[].slice.call(document.querySelectorAll('h1, h2'));
  heads.forEach(function(h){
    h.__w=splitWords(h);
    if(!SHOT) gsap.set(h.__w,{yPercent:112});
  });

  /* ---------------- reveals ----------------
     peak.js pose .in via IntersectionObserver ; on la pose tout de suite pour
     désarmer son opacity:0, puis GSAP prend la main. */
  var rvs=[].slice.call(document.querySelectorAll('.rv'));
  rvs.forEach(function(el){ el.classList.add('in'); });
  if(!SHOT) gsap.set(rvs.filter(function(el){ return !el.closest('.hero'); }),{opacity:0,y:26});

  if(SHOT){                                     // capture headless : état final, pas de ScrollTrigger
    html.classList.add('mo-done');
    gsap.set('.wi',{yPercent:0});
    gsap.set(rvs,{opacity:1,y:0});
    if(q.get('y')) document.body.style.marginTop=(-q.get('y'))+'px';   // scrollTo() laisse les tuiles noires en headless
    return;
  }

  /* ---------------- chien de garde ----------------
     Si requestAnimationFrame ne tourne pas (onglet en arrière-plan au chargement,
     compositeur absent, extension qui bloque), le ticker GSAP reste à 0 et rien
     n'avance : le contenu resterait invisible. On force alors l'état final. */
  setTimeout(function(){
    if(gsap.ticker.time > .5) return;
    gsap.globalTimeline.clear();
    gsap.set('.wi',{yPercent:0});
    gsap.set(rvs,{opacity:1,y:0,clearProps:'transform'});
    gsap.set('.exc, .gal a',{clipPath:'none',opacity:1,y:0,scale:1});
    html.classList.add('mo-done');
  },3000);

  /* ---------------- scrolling ----------------
     Removed Lenis (eased/inertia smooth-scroll) entirely, site-wide — its
     spring-lag made scrolling feel heavy and unresponsive, worst on short
     pages where a single wheel/touch gesture was dominated by the easing
     curve instead of moving the page. Native scroll only, everywhere.
     ScrollTrigger works fine off native scroll with no proxy needed.
     In-page anchor links (nav "#exp" etc.) still get a smooth jump via
     the browser's own scrollIntoView, just without Lenis in the loop. */
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener('click',function(e){
      var t=document.querySelector(a.getAttribute('href'));
      if(!t) return;
      e.preventDefault();
      var y=t.getBoundingClientRect().top+window.scrollY-70;
      window.scrollTo({top:y,behavior:'smooth'});
    });
  });

  /* ---------------- start ----------------
     No loader any more. The hero animates in as soon as its photo is ready,
     or after 600 ms, whichever comes first. */
  var started=false;
  function start(){ if(started) return; started=true; html.classList.add('mo-done'); heroIn(); ScrollTrigger.refresh(); }
  var hbg=document.querySelector('.hbg'), heroImg=new Image();
  heroImg.onload=heroImg.onerror=start;
  var bgUrl=hbg?getComputedStyle(hbg).backgroundImage.replace(/^url\(["']?/,'').replace(/["']?\)$/,''):'';
  if(bgUrl && bgUrl!=='none') heroImg.src=bgUrl;
  setTimeout(start,600);

  /* ---------------- hero ---------------- */
  var heroShown=false;
  function heroIn(){
    if(heroShown) return; heroShown=true;
    var h1=document.querySelector('.hero h1');
    var tl=gsap.timeline();
    if(h1) tl.to(h1.__w,{yPercent:0,duration:1.25,ease:'power4.out',stagger:.045});
    tl.fromTo('.hero .rv:not(h1)',{opacity:0,y:24},{opacity:1,y:0,duration:1,ease:'power3.out',stagger:.13},.25)
      .fromTo('.hfoot',{opacity:0},{opacity:1,duration:1.1},.6);
  }

  var hero=document.querySelector('.hero');
  if(hero){
    // la mer descend plus lentement que la page, le texte s'efface en montant
    gsap.to('.hvid, .hbg',{yPercent:16,scale:1.12,ease:'none',
      scrollTrigger:{trigger:hero,start:'top top',end:'bottom top',scrub:true}});
    gsap.to('.hero .hc',{y:-70,opacity:0,ease:'none',
      scrollTrigger:{trigger:hero,start:'top top',end:'70% top',scrub:true}});
    gsap.to('.hfoot',{opacity:0,ease:'none',
      scrollTrigger:{trigger:hero,start:'top top',end:'40% top',scrub:true}});
  }

  /* ---------------- titres au scroll ---------------- */
  heads.forEach(function(h){
    if(h.closest('.hero')) return;
    gsap.to(h.__w,{yPercent:0,duration:1.05,ease:'power4.out',stagger:.035,
      scrollTrigger:{trigger:h,start:'top 88%'}});
  });

  /* ---------------- reveals au scroll (groupés par section) ---------------- */
  document.querySelectorAll('section, footer').forEach(function(sec){
    var items=[].slice.call(sec.querySelectorAll('.rv'));
    if(!items.length) return;
    gsap.to(items,{opacity:1,y:0,duration:.95,ease:'power3.out',stagger:.09,
      scrollTrigger:{trigger:sec,start:'top 80%'}});
  });

  /* ---------------- compteurs (7 · 580m · ★ 5.0) ---------------- */
  document.querySelectorAll('.sn').forEach(function(el){
    var raw=el.textContent, m=raw.match(/[\d.]+/);
    if(!m) return;
    var target=parseFloat(m[0]), dec=(m[0].split('.')[1]||'').length;
    var o={v:0};
    gsap.to(o,{v:target,duration:1.6,ease:'power2.out',
      scrollTrigger:{trigger:el,start:'top 92%'},
      onUpdate:function(){ el.textContent=raw.replace(m[0], o.v.toFixed(dec)); },
      onComplete:function(){ el.textContent=raw; }});
  });

  /* ---------------- parallaxe des photos ----------------
     .pb = fond photo dans un cadre en overflow:hidden → on peut le sur-dimensionner. */
  document.querySelectorAll('.pb').forEach(function(el){
    gsap.fromTo(el,{yPercent:-7,scale:1.14},{yPercent:7,scale:1.04,ease:'none',
      scrollTrigger:{trigger:el.parentElement,start:'top bottom',end:'bottom top',scrub:true}});
  });
  ['.cbg','.ctabg'].forEach(function(sel){
    document.querySelectorAll(sel).forEach(function(el){
      gsap.fromTo(el,{yPercent:-9,scale:1.16},{yPercent:9,scale:1.02,ease:'none',
        scrollTrigger:{trigger:el.parentElement,start:'top bottom',end:'bottom top',scrub:true}});
    });
  });

  /* ---------------- cartes expériences : entrée en volet + inclinaison ---------------- */
  document.querySelectorAll('.exc').forEach(function(c,i){
    gsap.fromTo(c,{clipPath:'inset(0 0 100% 0)',y:40},
      {clipPath:'inset(0 0 0% 0)',y:0,duration:1.15,ease:'power3.out',delay:i*.09,
       scrollTrigger:{trigger:c.parentElement,start:'top 82%'}});
    if(MOBILE) return;
    var rx=gsap.quickTo(c,'rotateY',{duration:.7,ease:'power3'});
    var ry=gsap.quickTo(c,'rotateX',{duration:.7,ease:'power3'});
    var sc=gsap.quickTo(c,'scale',{duration:.7,ease:'power3'});
    c.addEventListener('pointermove',function(e){
      var r=c.getBoundingClientRect();
      rx(((e.clientX-r.left)/r.width-.5)*7);
      ry(-((e.clientY-r.top)/r.height-.5)*7);
      sc(1.02);
    });
    c.addEventListener('pointerleave',function(){ rx(0); ry(0); sc(1); });
  });

  /* ---------------- galerie : volet + dérive ---------------- */
  document.querySelectorAll('.gal a').forEach(function(a,i){
    gsap.fromTo(a,{clipPath:'inset(0 0 100% 0)',scale:1.04},
      {clipPath:'inset(0 0 0% 0)',scale:1,duration:1.1,ease:'power3.out',delay:(i%4)*.08,
       scrollTrigger:{trigger:a,start:'top 92%'}});
    var img=a.querySelector('img');
    if(img) gsap.fromTo(img,{yPercent:-5,scale:1.12},{yPercent:5,scale:1.04,ease:'none',
      scrollTrigger:{trigger:a,start:'top bottom',end:'bottom top',scrub:true}});
  });

  /* ---------------- inclusions & avis : décalage ---------------- */
  gsap.utils.toArray('.ii').forEach(function(el,i){
    gsap.fromTo(el,{y:34,opacity:0},{y:0,opacity:1,duration:1,ease:'power3.out',delay:i*.1,
      scrollTrigger:{trigger:el.parentElement,start:'top 84%'}});
  });

  addEventListener('load',function(){ ScrollTrigger.refresh(); });
})();
