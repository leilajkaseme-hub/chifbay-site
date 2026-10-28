/* One invitation per tab session, shared between home and catalogue. */
(()=>{
 const script=document.currentScript,base=new URL('.',script.src),page=new URL(script.dataset.reviewPage||'avaliar.html',base);
 const site=base.pathname, key='review-invitation:v1:'+site;
 const normalize=p=>p.replace(/\.html$/,'').replace(/\/$/,'');const onReview=normalize(location.pathname)===normalize(page.pathname);
 let state={started:Date.now(),shown:false};
 try{const saved=JSON.parse(sessionStorage.getItem(key));if(saved&&Number.isFinite(saved.started))state=saved;}catch{}
 const save=()=>{try{sessionStorage.setItem(key,JSON.stringify(state));}catch{}};
 if(onReview){state.shown=true;save();return;}
 save();let timer;
 const go=()=>{state.shown=true;save();location.assign(page.href);};
 const schedule=()=>{clearTimeout(timer);if(state.shown)return;const remaining=Math.max(0,300000-(Date.now()-state.started));timer=setTimeout(()=>{if(document.visibilityState==='visible')go();},remaining);};
 const mount=()=>{if(document.querySelector('.review-shortcut'))return;const a=document.createElement('a');a.className='review-shortcut';a.href=page.href;a.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"/></svg><span></span>';
 const translate=()=>{a.querySelector('span').textContent=document.documentElement.lang.startsWith('en')?'Leave a review':'Deixar uma avaliação';};translate();new MutationObserver(translate).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});a.addEventListener('click',()=>{state.shown=true;save();clearTimeout(timer);});document.body.append(a);};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')schedule();});window.addEventListener('pageshow',schedule);schedule();
})();
