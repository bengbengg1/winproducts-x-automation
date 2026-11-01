'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {findExtension,EXTENSION_ID}=require('../src/extension-path');
const {showPanel,screenshotPair}=require('../src/extension-capture');
const {add,approve}=require('../src/research-queue');
const {cleanLinks}=require('../src/discover-products');
const sharp=require('sharp');
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'wp-test-'));
test('finds installed WinProducts extension without developer source or browser credentials',()=>{
 const root=temp();
 try{
  const folder=path.join(root,'Library','Application Support','Google','Chrome','Default','Extensions',EXTENSION_ID,'0.1.31_0');
  fs.mkdirSync(folder,{recursive:true});
  fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify({manifest_version:3,name:'WinProducts',version:'0.1.31'}));
  const found=findExtension({override:null,home:root,platform:'darwin'});
  assert.equal(found.directory,folder);
  assert.equal(found.origin,'chrome-installed');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('product queue rejects invented placeholders and duplicates; never auto-approves',()=>{
 const root=temp(),f=path.join(root,'research.json');
 try{
  assert.throws(()=>add({productUrl:'https://example.com/products/x',storeName:'x',productName:'y',file:f}),/Geçerli HTTPS/);
  const a=add({productUrl:'https://shop.test/products/pillow',storeName:'Test',productName:'Pillow',file:f});
  assert.equal(a.added,true);
  assert.equal(a.record.approved,false);
  assert.equal(add({productUrl:'https://shop.test/products/pillow',storeName:'Test',productName:'Pillow',file:f}).added,false);
  assert.equal(JSON.parse(fs.readFileSync(f)).records.length,1);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('discovery keeps only same-host public Shopify product pages',()=>{
 const result=cleanLinks([{href:'/products/one?variant=5',text:'Our good product'},{href:'https://evil.test/products/x',text:'fake'},{href:'/collections/all',text:'Collection'},{href:'/products/one',text:'Duplicate'}], 'https://shop.test/');
 assert.deepEqual(result,[{url:'https://shop.test/products/one',label:'Our good product'}]);
});
test('headless mode fails closed if the extension panel selectors are unknown',async()=>{
 await assert.rejects(showPanel({},{interactive:false,launcher:null,panel:null}),/WINPRODUCTS_OPEN_SELECTOR/);
 await assert.rejects(showPanel({locator:()=>({first:()=>({click:async()=>{}})})},{interactive:false,launcher:'#open',panel:null}),/WINPRODUCTS_PANEL_READY_SELECTOR/);
});
test('screenshot pairing writes exactly one real-frame PNG per slot, kept unapproved',async()=>{
 const root=temp();
 const png=await sharp({create:{width:1600,height:900,channels:4,background:'#fff'}}).png().toBuffer();
 const screenshots=[];
 const page={};
 const desktopCaptureFn=async ({outputPath})=>{fs.writeFileSync(outputPath,png);screenshots.push(outputPath);};
 const fixture={page,context:{close:async()=>{}}};
 try{
  const result=await screenshotPair({root,date:'2026-11-01',record:{id:'test-1',productUrl:'https://shop.test/products/one'},interactive:false,
   openBrowserFn:async()=>fixture,showPanelFn:async()=>true,desktopCaptureFn});
  assert.equal(screenshots.length,2);
  assert.equal(fs.existsSync(path.join(root,result.linked)),true);
  assert.equal(fs.existsSync(path.join(root,result.plain)),true);
  assert.match(result.linked,/test-1-linked.png$/);
  assert.equal(result.captureOrigin,'x11-full-desktop');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('approving requires user-supplied insight and two existing real-sized images',async()=>{
 const root=temp(),f=path.join(root,'db.json');
 try{
  const a=add({productUrl:'https://store.test/products/mug',storeName:'Store',productName:'Mug',file:f});
  await assert.rejects(approve({id:a.record.id,file:f}),/Gerçek eklenti görüntüleri eksik/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('traffic/revenue text is extracted only from provided actual panel text',()=>{
 const {parsePanelText,summarizeMetrics}=require('../src/insights');
 const m=parsePanelText('Traffic & Revenue\nMONTHLY VISITS\n112.1K\nEST. SALES\n€84.7K\n');
 assert.equal(m.monthlyVisits,'112.1K');
 assert.equal(m.estimatedSales,'€84.7K');
 assert.match(summarizeMetrics(m),/tahmini/);
 assert.equal(summarizeMetrics(parsePanelText('Please sign in')),null);
});
