/* ============================================================
   Chifbay — ATLAS motion engine
   Pure CSS transforms + IntersectionObserver + rAF. No WebGL,
   no scroll hijack, no animation library. Reading never depends
   on animation. Full prefers-reduced-motion path.
   ============================================================ */
(function(){
  var root=document.documentElement;
  if(!root.classList.contains('atlas')) return;

  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mobile=matchMedia('(max-width:900px)').matches;

  /* keep nav clear of the announcement bar — measure real height (it may wrap on mobile) */
  var annc=document.querySelector('.annc');
  if(annc){
    root.classList.add('has-annc');
    var setAnncH=function(){ root.style.setProperty('--annc-h', annc.offsetHeight+'px'); };
    setAnncH(); addEventListener('resize',setAnncH,{passive:true});
    addEventListener('load',setAnncH);
  }

  /* headless capture helper (no effect unless ?cap= is present):
     forces final state and offsets content up so a viewport shot can frame any band */
  var CAP=new URLSearchParams(location.search);
  if(CAP.has('cap')){
    addEventListener('DOMContentLoaded',function(){
      document.querySelectorAll('.reveal,.clip,.route-fig,[data-mask]').forEach(function(el){el.classList.add('in');});
      document.querySelectorAll('.mask-c').forEach(function(c){c.style.transform='none';c.style.transitionDelay='0ms';});
      var y=+CAP.get('cap')||0; if(y) document.body.style.marginTop=(-y)+'px';
    });
  }

  /* ---------- word-mask headlines ----------
     Split text nodes into masked words, preserving <em>/<strong>/<br>. */
  function splitMask(el){
    var out=[];
    (function walk(node){
      Array.prototype.slice.call(node.childNodes).forEach(function(n){
        if(n.nodeType===3){
          if(!n.textContent.trim()){ return; }
          var frag=document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function(part){
            if(!part) return;
            if(/^\s+$/.test(part)){ frag.appendChild(document.createTextNode(' ')); return; }
            var w=document.createElement('span'); w.className='mask-w';
            var c=document.createElement('span'); c.className='mask-c'; c.textContent=part;
            w.appendChild(c); frag.appendChild(w); out.push(c);
          });
          n.parentNode.replaceChild(frag,n);
        } else if(n.nodeType===1 && n.tagName!=='BR'){
          // gradient/italic accent words: animate whole node, don't split
          walk(n);
        }
      });
    })(el);
    return out;
  }

  if(!reduce){
    document.querySelectorAll('[data-mask]').forEach(function(el){
      // wrap each existing line (split on <br>) in an overflow-clip line
      var html=el.innerHTML.split(/<br\s*\/?>/i);
      el.innerHTML=html.map(function(seg){ return '<span class="mask-line">'+seg+'</span>'; }).join('');
      el.querySelectorAll('.mask-line').forEach(function(line){ splitMask(line); });
      el.__cs=el.querySelectorAll('.mask-c');
    });
  }

  /* ---------- IntersectionObserver reveals ---------- */
  var io=new IntersectionObserver(function(es){
    es.forEach(function(e){
      if(!e.isIntersecting) return;
      var t=e.target;
      t.classList.add('in');
      if(t.__cs){
        var d=0;
        t.__cs.forEach(function(c){ c.style.transitionDelay=(d)+'ms'; d+=42; });
      }
      io.unobserve(t);
    });
  },{threshold:.12,rootMargin:'0px 0px -8% 0px'});

  document.querySelectorAll('.reveal, .clip, .route-fig, [data-mask], .mask-run-t')
    .forEach(function(el){ io.observe(el); });

  /* headlines with data-mask also need the run trigger */
  if(!reduce){
    document.querySelectorAll('[data-mask]').forEach(function(el){
      new IntersectionObserver(function(es,ob){
        es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); ob.disconnect(); } });
      },{threshold:.2}).observe(el);
    });
  }

  /* ---------- stat / fact counters ---------- */
  document.querySelectorAll('[data-count]').forEach(function(el){
    var raw=el.getAttribute('data-count');
    var m=raw.match(/[\d.]+/); if(!m){ el.textContent=raw; return; }
    var target=parseFloat(m[0]), dec=(m[0].split('.')[1]||'').length, pre=raw.slice(0,m.index), suf=raw.slice(m.index+m[0].length);
    if(reduce){ el.textContent=raw; return; }
    new IntersectionObserver(function(es,ob){
      es.forEach(function(e){
        if(!e.isIntersecting) return; ob.disconnect();
        var t0=null, dur=1400;
        function step(ts){
          if(t0===null) t0=ts;
          var p=Math.min((ts-t0)/dur,1), eased=1-Math.pow(1-p,3);
          el.textContent=pre+(target*eased).toFixed(dec)+suf;
          if(p<1) requestAnimationFrame(step); else el.textContent=raw;
        }
        requestAnimationFrame(step);
      });
    },{threshold:.6}).observe(el);
  });

  /* ---------- scroll-linked hero + parallax (rAF, in-view only) ---------- */
  if(!reduce){
    var heroMedia=document.querySelector('.hero-media .hbg, .hero-media .hvid');
    var heroCopy=document.querySelector('.hero .hc');
    var hero=document.querySelector('.hero');
    var paras=[].slice.call(document.querySelectorAll('[data-parallax]'));
    var ticking=false, vh=innerHeight;

    function onResize(){ vh=innerHeight; mobile=matchMedia('(max-width:900px)').matches; }
    addEventListener('resize',onResize,{passive:true});

    function frame(){
      ticking=false;
      var y=scrollY;
      // hero: media drifts down slowly, copy lifts + fades → arrival to exploration
      if(hero){
        var hr=hero.getBoundingClientRect();
        if(hr.bottom>0 && hr.top<vh){
          var p=Math.min(Math.max(-hr.top/hero.offsetHeight,0),1);
          if(heroMedia) heroMedia.style.transform='translate3d(0,'+(p*7).toFixed(2)+'%,0) scale('+(1+p*0.06).toFixed(4)+')';
          if(heroCopy){ heroCopy.style.transform='translate3d(0,'+(p*-46).toFixed(1)+'px,0)'; heroCopy.style.opacity=(1-p*1.15).toFixed(3); }
        }
      }
      // low-amplitude parallax (3–6%) on flagged background images, in view only
      if(!mobile){
        for(var i=0;i<paras.length;i++){
          var el=paras[i], r=el.parentElement.getBoundingClientRect();
          if(r.bottom<0||r.top>vh) continue;
          var mid=(r.top+r.height/2-vh/2)/vh;          // -1..1 across viewport
          var amp=parseFloat(el.getAttribute('data-parallax'))||5;
          el.style.transform='translate3d(0,'+(mid*amp).toFixed(2)+'%,0)';
        }
      }
    }
    function onScroll(){ if(!ticking){ ticking=true; requestAnimationFrame(frame); } }
    addEventListener('scroll',onScroll,{passive:true});
    frame();
  }
})();
