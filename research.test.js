"use strict";
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const os=require('node:os');
const sharp=require('sharp');
const {pickCandidate,buildDay}=require('../src/research');
const {renderPost}=require('../src/visuals');
const ROOT=path.resolve(__dirname,'..');
function mk(){const p=fs.mkdtempSync(path.join(os.tmpdir(),'wp-real-'));return {p,feed:path.join(p,'candidates.json'),hist:path.join(p,'history.json')};}
const proto=(id,category='stores')=>({id,category,approved:true,storeName:'Demo Store',productName:'Demo Product',storeUrl:'https://example.com',productUrl:'https://example.com/products/1',insight:'Ürün teklifinde farklı paket seçenekleri bulunuyor.',takeaway:'Fiyat ve teklif sayfası birlikte incelendi.',checkedAt:'2026-11-01',signals:{trafficGrowthPct:50,activeAds:3},evidence:[{url:'https://example.com/products/1',summary:'Ürün sayfası',checkedAt:'2026-11-01'}],captureMethod:'winproducts-chrome-extension',captureOrigin:'x11-full-desktop',screenshotApproved:true,screenshots:{linked:'assets/sources/testing-real-linked.png',plain:'assets/sources/testing-real-plain.png'}});
test('No invented or unapproved product can be selected',()=>{const x=mk();fs.writeFileSync(x.feed,JSON.stringify({records:[{...proto('aa'),approved:false}]}));assert.throws(()=>pickCandidate('2026-11-01','stores',{file:x.feed,historyFile:x.hist}),/bulunamadi/);});
test('Daily selection uses score and 30-day store exclusion',()=>{const x=mk();const a=proto('aa'),b={...proto('bb'),storeName:'Another',storeUrl:'https://different.example',signals:{trafficGrowthPct:120,activeAds:10}};fs.writeFileSync(x.feed,JSON.stringify({records:[a,b]}));assert.equal(pickCandidate('2026-11-01','stores',{file:x.feed,historyFile:x.hist}).id,'bb');fs.writeFileSync(x.hist,JSON.stringify({'2026-10-31':{id:'bb',storeUrl:b.storeUrl}}));assert.equal(pickCandidate('2026-11-01','stores',{file:x.feed,historyFile:x.hist}).id,'aa');});
test('Real-only renderer blocks fabricated graphics',async()=>{delete process.env.ALLOW_ILLUSTRATIVE_PREVIEW;const out=mk();await assert.rejects(renderPost({id:'fake',category:'stores',text:'test',kind:'linked'},{outputDir:out.p}),/Gercek eklentili/);});
test('Actual screenshot is preserved as one 1600x900 PNG',async()=>{delete process.env.ALLOW_ILLUSTRATIVE_PREVIEW;const out=mk();const image='assets/sources/testing-real-linked.png';fs.mkdirSync(path.join(ROOT,'assets/sources'),{recursive:true});await sharp({create:{width:1600,height:900,channels:3,background:'#223344'}}).png().toFile(path.join(ROOT,image));try{const result=await renderPost({id:'genuine',category:'stores',text:'test',kind:'linked',sourceType:'real-extension-screenshot',visualApproved:true,sourceScreenshot:image},{outputDir:out.p});assert.equal(result.sourceType,'real-extension-screenshot');assert.equal(result.imageSha256.length,64);assert.deepEqual((await sharp(path.join(out.p,'genuine.png')).metadata()).width,1600);}finally{fs.unlinkSync(path.join(ROOT,image));}});
