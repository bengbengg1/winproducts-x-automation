'use strict';
/** A connection-free smoke test: the real extension is installed and Chrome can load it.
 * This does NOT prove that the authenticated WinProducts side panel works.
 */
const path=require('node:path');
const fs=require('node:fs');
const {findExtension,EXTENSION_ID}=require('./extension-path');
const {chromium}=require('playwright');

async function smoke({root=path.resolve(__dirname,'..'),browser=chromium}={}){
 const extension=findExtension();
 const manifest=JSON.parse(fs.readFileSync(path.join(extension.directory,'manifest.json'),'utf8'));
 if(!manifest.version || !manifest.key)throw new Error('Resmî Chrome Web Store eklenti kimliği korunmamış (manifest.key yok).');
 const profile=path.join(root,'.browser-profile','extension-smoke');
 fs.mkdirSync(profile,{recursive:true});
 const context=await browser.launchPersistentContext(profile,{
  channel:'chromium',headless:false,viewport:{width:1280,height:760},
  args:[`--disable-extensions-except=${extension.directory}`,`--load-extension=${extension.directory}`,'--window-size=1600,900','--no-first-run']
 });
 try{
  const page=context.pages()[0]||await context.newPage();
  await page.goto('data:text/html,<title>WinProducts extension test</title><h1>WinProducts Web Store extension launch test</h1>');
  let workers=context.serviceWorkers();
  if(workers.length===0){
    try{await context.waitForEvent('serviceworker',{timeout:12000});}catch{ /* May sleep until triggered. */ }
    workers=context.serviceWorkers();
  }
  const active=workers.map(w=>w.url()).find(url=>url.startsWith(`chrome-extension://${EXTENSION_ID}/`));
  if(!active)throw new Error('Tarayıcı başlatıldı, ancak WinProducts uzantı service worker kimliği doğrulanamadı. Bu test geçmedi.');
  return {extensionId:EXTENSION_ID,version:manifest.version,worker:active,webStoreDownload:extension.origin==='official-web-store-cache',authenticated:false,panelVerified:false};
 }finally{await context.close();}
}

if(require.main===module)smoke().then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={smoke};
