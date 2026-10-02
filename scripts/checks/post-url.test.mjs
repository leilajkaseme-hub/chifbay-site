import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {postUrl} from '../post-url.mjs';
test('mixed historical canonicals and new translations retain their own URLs',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'chifbay-url-'));
 try{
  for(const [lang,suffix] of [['',''],['fr','.html']]){
   const dir=path.join(root,lang,'posts');fs.mkdirSync(dir,{recursive:true});
   const url=`https://chifbay.com/${lang?lang+'/':''}posts/day-trip${suffix}`;
   fs.writeFileSync(path.join(dir,'day-trip.html'),`<link rel="canonical" href="${url}"/>`);
   assert.equal(postUrl(root,'day-trip',lang),url);
  }
  assert.equal(postUrl(root,'day-trip','de'),'https://chifbay.com/de/posts/day-trip.html');
  assert.throws(()=>postUrl(root,'../outside'));
  fs.writeFileSync(path.join(root,'posts/day-trip.html'),'<link rel="canonical" href="https://example.com/"/>');
  assert.throws(()=>postUrl(root,'day-trip'));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
