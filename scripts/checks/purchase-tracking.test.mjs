import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../../booking-done.html',import.meta.url),'utf8');
const block=html.slice(html.indexOf('      // The money event.'),html.indexOf('      // Le numero WhatsApp'));
function setup({ready=true,state='interactive',testPayment=false,throws=false}={}){
 const events=[],store=new Map(),listeners=[];
 const context={res:{test:testPayment,amount:40000,currency:'eur'},id:'synthetic',b:{label:'Sunset'},window:{},document:{readyState:state,addEventListener:(name,fn)=>listeners.push(fn)},sessionStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)}};
 function install(){context.window.cbTrack=(...e)=>{if(throws)throw Error('tracker unavailable');events.push(e);};}
 if(ready)install();
 return {events,store,install,run:()=>vm.runInNewContext(block,context),dom:()=>listeners.splice(0).forEach(f=>f())};
}
test('ready tracker records amount and transaction once across reloads',()=>{const c=setup();c.run();c.run();assert.equal(c.events.length,1);assert.equal(c.events[0][2].value,400);assert.equal(c.events[0][2].transaction_id,'synthetic');});
test('fast session response waits for deferred tracking',()=>{const c=setup({ready:false});c.run();assert.equal(c.store.size,0);c.install();c.dom();c.run();assert.equal(c.events.length,1);});
test('blocked tracker does not mark a purchase sent',()=>{const c=setup({ready:false});c.run();c.dom();assert.equal(c.store.size,0);c.install();c.run();assert.equal(c.events.length,1);});
test('test payment excluded',()=>{const c=setup({testPayment:true});c.run();assert.equal(c.events.length,0);assert.equal(c.store.size,0);});
test('throwing tracker cannot mark purchase or break confirmation',()=>{const c=setup({throws:true});assert.doesNotThrow(c.run);assert.equal(c.store.size,0);});
test('completed document with blocked tracker remains safe',()=>{const c=setup({ready:false,state:'complete'});c.run();assert.equal(c.store.size,0);});
test('unpaid response returns before tracking code',()=>{assert.match(html,/if \(!res\.paid\) \{[\s\S]*?return;\s*\}\s*var b = res.booking/);});
