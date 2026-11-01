'use strict';
/** Generate a daily shortlist from user-specified public Shopify stores.
 * Visits only configured storefront pages; no WinProducts API, private endpoints,
 * captcha bypass, broad crawling, or unverified sales claims.
 */
const fs=require('node:fs');
const path=require('node:path');
const {add}=require('./research-queue');
const ROOT=path.resolve(__dirname,'..');
const SOURCE=path.join(ROOT,'data/store-seeds.json');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function cleanLinks(links,storeUrl,max=8){
 const origin=new URL(storeUrl).origin;
 const unique=new Map();
 for(const link of links){
  try{
   const u=new URL(link.href,origin);u.hash='';u.search='';
   if(u.protocol!=='https:'||u.origin!==origin||!/^\/products\/[^/?#]+/.test(u.pathname))continue;
   const label=String(link.text||'').replace(/\s+/g,' ').trim().slice(0,100);
   if(!label||label.toLowerCase()==='shop now'||label.toLowerCase()==='view details')continue;
   if(!unique.has(u.toString()))unique.set(u.toString(),{url:u.toString(),label});
   if(unique.size>=max)break;
  }catch{}
 }
 return [...unique.values()];
}
async function discover({file=SOURCE,pageFactory=null,waitFn=wait,saveFn=add}={}){
 if(!fs.existsSync(file))throw new Error('data/store-seeds.json bulunamadı. store-seeds.sample.json dosyasını kopyalayın.');
 const stores=JSON.parse(fs.readFileSync(file,'utf8')).stores;
 if(!Array.isArray(stores)||!stores.length||stores.length>20)throw new Error('1-20 adet izinli mağaza başlangıç URL’si gerekli');
 let browser=null;
 if(!pageFactory){
  const {chromium}=require('playwright');
  browser=await chromium.launch({channel:'chromium',headless:true});
  pageFactory=async()=>await browser.newPage({viewport:{width:1280,height:800}});
 }
 const added=[],failures=[];
 try{
  for(const store of stores){
   let page;
   try{
    if(!store.enabled)continue;
    const u=new URL(store.url);
    if(u.protocol!=='https:'||u.username||u.password)throw new Error('Sadece HTTPS mağaza adresi');
    const display=String(store.name||'').trim();if(!display)throw new Error('Mağaza adı eksik');
    page=await pageFactory();
    await page.goto(u.toString(),{waitUntil:'domcontentloaded',timeout:30000});
    const links=await page.locator('a[href]').evaluateAll(anchors=>anchors.map(a=>({href:a.getAttribute('href'),text:(a.textContent||a.getAttribute('aria-label')||'').trim()})));
    const products=cleanLinks(links,u.toString(),Number(store.limit)||8);
    for(const p of products){
     const result=saveFn({productUrl:p.url,storeName:display,productName:p.label,category:store.category||'stores'});
     if(result.added)added.push({id:result.record.id,product:p.label,url:p.url});
    }
    if(!products.length)failures.push({store:display,reason:'Ana sayfada /products/ bağlantısı bulunamadı; kullanıcı doğrudan ürün URL’si ekleyebilir'});
   }catch(e){failures.push({store:store.name||store.url,error:e.message});}
   finally{await page?.close();}
   await waitFn(1200);
  }
 }finally{await browser?.close();}
 return {newCandidates:added.length,added,failures,approvedForPublication:0};
}
if(require.main===module)discover().then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={cleanLinks,discover};
