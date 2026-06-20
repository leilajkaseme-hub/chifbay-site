// Chifbay — shared interactions
(function(){
  var nav=document.getElementById('nav');
  function onScroll(){ if(nav) nav.classList.toggle('sc', window.scrollY>60); }
  window.addEventListener('scroll',onScroll,{passive:true}); onScroll();

  var tog=document.querySelector('.navtoggle'), nl=document.querySelector('.nl');
  if(tog&&nl){
    tog.addEventListener('click',function(){ nl.classList.toggle('open'); });
    nl.querySelectorAll('a').forEach(function(a){ a.addEventListener('click',function(){ nl.classList.remove('open'); }); });
  }

  var io=new IntersectionObserver(function(es){
    es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
  },{threshold:.1,rootMargin:'0px 0px -36px 0px'});
  document.querySelectorAll('.rv:not(.in)').forEach(function(el){ io.observe(el); });

  var y=document.getElementById('yr'); if(y) y.textContent=new Date().getFullYear();
})();
