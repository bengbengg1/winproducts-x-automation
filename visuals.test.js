'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const sharp=require('sharp');
const {planDay}=require('../src/editorial');
const {renderPosts,renderPost,getCurated,WIDTH,HEIGHT}=require('../src/visuals');
const bank=require('../data/content-bank.json');
const ROOT=path.resolve(__dirname,'..');
process.env.ALLOW_ILLUSTRATIVE_PREVIEW='true';
process.on('exit',()=>{try{fs.unlinkSync(path.join(ROOT,'assets/sources/visual-test.png'));}catch{}});
test('all four categories render true 16:9 PNG with one image per post',async()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'winproducts-render-'));
 for(const i of [0,1,2,7]){
  const posts=planDay(new Date(Date.UTC(2026,10,1+i)).toISOString().slice(0,10),'2026-11-01',bank);
  const ready=await renderPosts(posts,{outputDir:out});
  assert.equal(ready.length,2);
  for(const post of ready){
   assert.ok(post.alt.length>20);assert.equal(post.sourceType,'illustrative-template');
   const info=await sharp(path.join(out,post.id+'.png')).metadata();
   assert.deepEqual([info.width,info.height,info.format],[WIDTH,HEIGHT,'png']);
   assert.equal(post.imageSha256.length,64);
  }
 }
});
test('only approved records can show authentic screenshots, and paths stay in repo',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'winproducts-sources-'));
 const shot='assets/sources/visual-test.png';fs.mkdirSync(path.join(ROOT,'assets/sources'),{recursive:true});
 await sharp({create:{width:600,height:400,channels:3,background:'#579fa3'}}).png().toFile(path.join(ROOT,shot));
 const post=planDay('2026-11-01','2026-11-01',bank)[0];
 const record={postId:post.id,category:'stores',approved:true,asOf:'2026-10-31',name:'Örnek onaylı mağaza',title:'Mağaza sayfası ve veri paneli',storeScreenshot:shot,panelScreenshot:shot,metrics:[]};
 const file=path.join(dir,'research.json');fs.writeFileSync(file,JSON.stringify({records:[record]}));
 assert.equal(getCurated(post,{researchFile:file}).name,'Örnek onaylı mağaza');
 const render=await renderPost(post,{outputDir:dir,researchFile:file});
 assert.equal(render.sourceType,'approved-screenshots');
 record.approved=false;fs.writeFileSync(file,JSON.stringify({records:[record]}));
 await assert.rejects(renderPost(post,{outputDir:dir,researchFile:file}),/onaysız/);
 record.approved=true;record.storeScreenshot='../outside.png';fs.writeFileSync(file,JSON.stringify({records:[record]}));
 await assert.rejects(renderPost(post,{outputDir:dir,researchFile:file}),/proje dışına/);
});
