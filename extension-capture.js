'use strict';
const path=require('node:path');
const fs=require('node:fs');
const readline=require('node:readline/promises');
const {stdin: input, stdout: output}=require('node:process');
const {findExtension}=require('./extension-path');
const {parsePanelText}=require('./insights');
const {captureDesktop}=require('./desktop-capture');

function screenName(file){return path.basename(file).replace(/[^a-zA-Z0-9._-]/g,'_');}
function safeCapturePath(file,root){
 const resolved=path.resolve(root,file);
 if(!resolved.startsWith(root+path.sep))throw new Error('Görsel yolu proje sınırları dışında');
 return resolved;
}
function cleanProfile(profile,root){
 const resolved=path.resolve(profile);
 // Never accidentally drive real Chrome personal profile with Playwright.
 if(!resolved.startsWith(root+path.sep) || !resolved.includes('.browser-profile'))throw new Error('Sadece projeye özel .browser-profile/ kullanılabilir');
 return resolved;
}
async function askConfirm(message){
 const reader=readline.createInterface({input,output});
 try{return (await reader.question(message)).trim().toUpperCase()==='EVET';}
 finally{reader.close();}
}
async function openBrowser({productUrl,projectRoot,extensionDir,profile,headed=true,playwrightModule,viewport={width:1360,height:760}}){
 const u=new URL(productUrl);
 if(u.protocol!=='https:'||u.username||u.password)throw new Error('HTTPS ürün sayfası gerekli');
 const ext=extensionDir?findExtension({override:extensionDir}):findExtension();
 const playwright=playwrightModule||require('playwright');
 const userDir=cleanProfile(profile||path.join(projectRoot,'.browser-profile','winproducts'),projectRoot);
 fs.mkdirSync(userDir,{recursive:true});
 const context=await playwright.chromium.launchPersistentContext(userDir,{
  channel:'chromium',headless:false,viewport,deviceScaleFactor:1,
  args:[`--disable-extensions-except=${ext.directory}`,`--load-extension=${ext.directory}`, '--window-position=0,0', '--window-size=1600,900', '--no-first-run']
 });
 const page=context.pages()[0]||await context.newPage();
 await page.goto(u.toString(),{waitUntil:'domcontentloaded',timeout:45000});
 return {context,page,extension:ext};
}
/** Some extensions inject HTML; others use Chrome's own side panel.
 * Only injected HTML can be found using page.locator. A Chrome side panel
 * requires visible browser UI and an operator's confirmation until an
 * extension-specific user-action launcher is implemented and verified.
 */
async function showPanel(page,{launcher=process.env.WINPRODUCTS_OPEN_SELECTOR,panel=process.env.WINPRODUCTS_PANEL_READY_SELECTOR,interactive=false,prompt=askConfirm}={}){
 if(launcher){await page.locator(launcher).first().click({timeout:18000});}
 else if(!interactive){
   // The official Web Store listing documents a floating logo, but doesn't publish
   // a stable CSS selector: never guess and accidentally capture a hidden panel.
   throw new Error('Otomatik mod için WINPRODUCTS_OPEN_SELECTOR gerekli; ilk kurulumda --interactive kullanın');
 }
 if(panel){await page.locator(panel).first().waitFor({state:'visible',timeout:30000});}
 else if(!interactive){throw new Error('Otomatik mod için WINPRODUCTS_PANEL_READY_SELECTOR gerekli');}
 if(interactive){
   const yes=await prompt('Gerçek WinProducts paneli açık, ürün ve analiz değerleri görünür mü? EVET yazın: ');
   if(!yes)throw new Error('Operatör gerçek paneli doğrulamadı; ekran görüntüsü alınmadı');
 }
 return true;
}
async function screenshotPair({record,date,root=path.resolve(__dirname,'..'),interactive=false,extensionDir,profile,openBrowserFn=openBrowser,showPanelFn=showPanel,desktopCaptureFn=captureDesktop,prompt=askConfirm}={}){
 if(!record||!record.id||!record.productUrl)throw new Error('Ürün kaydı gerekli');
 const dest=path.join(root,'assets','sources',date);
 const linked=safeCapturePath(path.relative(root,path.join(dest,screenName(record.id)+'-linked.png')),root);
 const plain=safeCapturePath(path.relative(root,path.join(dest,screenName(record.id)+'-plain.png')),root);
 let browser;
 try{
   browser=await openBrowserFn({productUrl:record.productUrl,projectRoot:root,extensionDir,profile,headed:true});
   await showPanelFn(browser.page,{interactive,prompt});
   let panelMetrics=null;
   // Only read metrics from a visible, configured real extension panel. Never OCR or guess.
   const panelSelector=process.env.WINPRODUCTS_PANEL_READY_SELECTOR;
   if(panelSelector && browser.page.locator){
     try {panelMetrics=parsePanelText(await browser.page.locator(panelSelector).first().innerText({timeout:10000}));}
     catch {panelMetrics=null;}
   }
   fs.mkdirSync(dest,{recursive:true});
   await desktopCaptureFn({outputPath:linked});
   const secondary=process.env.WINPRODUCTS_SECOND_TAB_SELECTOR;
   if(secondary){
     await browser.page.locator(secondary).first().click({timeout:15000});
     if(process.env.WINPRODUCTS_PANEL_READY_SELECTOR)await browser.page.locator(process.env.WINPRODUCTS_PANEL_READY_SELECTOR).first().waitFor({state:'visible',timeout:15000});
   }else if(interactive){
     const yes=await prompt('19:30 tweeti için başka bir panel sekmesi seçtiniz mi? EVET (aynı görüntü de olabilir): ');
     if(!yes)throw new Error('İkinci görsel onaylanmadı');
   }
   await desktopCaptureFn({outputPath:plain});
   return {linked:path.relative(root,linked).replaceAll(path.sep,'/'),plain:path.relative(root,plain).replaceAll(path.sep,'/'),panelMetrics,captureOrigin:'x11-full-desktop'};
 }finally{await browser?.context?.close();}
}
module.exports={findExtension,openBrowser,showPanel,screenshotPair,askConfirm};
