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

  var io=new IntersectionObserver(function(es){
    es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
  },{threshold:.1,rootMargin:'0px 0px -36px 0px'});
  document.querySelectorAll('.rv:not(.in)').forEach(function(el){ io.observe(el); });

  var y=document.getElementById('yr'); if(y) y.textContent=new Date().getFullYear();
})();

(function(){
  var LL=["fr","de","pt","es","it"];
  function langOf(href){var s=(href||"").split("/").filter(Boolean);return LL.indexOf(s[0])>=0?s[0]:"en";}
  function pageFile(){var f=location.pathname.split("/").pop();return f||"index.html";}
  var p=location.pathname.split("/").filter(Boolean);
  var lang=(LL.indexOf(p[0])>=0)?p[0]:"en";
  var cb=document.querySelector(".langcode"); if(cb) cb.textContent=lang.toUpperCase();
  var menu=document.querySelectorAll(".langmenu a");
  menu.forEach(function(a){
    if(langOf(a.getAttribute("href"))===lang) a.classList.add("on");
    a.addEventListener("click",function(){ try{localStorage.setItem("chifbay_lang", langOf(a.getAttribute("href")));}catch(e){} });
  });
  var ls=document.querySelector(".langsel"), btn=ls&&ls.querySelector(".langbtn");
  if(btn){ btn.addEventListener("click",function(e){e.stopPropagation();ls.classList.toggle("open");});
    document.addEventListener("click",function(){ls.classList.remove("open");}); }
  fetch("/i18n-langs.json").then(function(r){return r.json();}).then(function(av){
    menu.forEach(function(a){ var l=langOf(a.getAttribute("href")); if(av.indexOf(l)<0){ a.style.opacity=".35"; a.style.pointerEvents="none"; } });
    var chosen=null; try{chosen=localStorage.getItem("chifbay_lang");}catch(e){}
    if(lang==="en" && !chosen){
      var nl=((navigator.languages&&navigator.languages[0])||navigator.language||"en").slice(0,2).toLowerCase();
      if(nl!=="en" && av.indexOf(nl)>=0){ try{localStorage.setItem("chifbay_lang",nl);}catch(e){} location.replace("/"+nl+"/"+pageFile()); }
    }
  }).catch(function(){});
})();
