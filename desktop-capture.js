'use strict';
/** Genuine X11 desktop capture, including the Chrome browser frame and side panel.
 * Playwright page.screenshot() does not capture Chrome's built-in side panel.
 * This module NEVER fabricates a WinProducts panel or grants publication approval.
 */
const fs=require('node:fs');
const path=require('node:path');
const {promisify}=require('node:util');
const {execFile}=require('node:child_process');
const run=promisify(execFile);

async function captureDesktop({outputPath,display=process.env.DISPLAY,runner=run,
                             platform=process.platform,validateImage=true}={}){
 if(platform!=='linux')throw new Error('Gerçek tarayıcı çerçevesi yakalama şu an Linux/X11 içindir; macOS/Windows için ayrı sürücü gerekli');
 if(!display)throw new Error('DISPLAY yok. Başsız GitHub ortamında Xvfb ile görünür Chromium çalıştırın');
 if(!outputPath||path.extname(outputPath).toLowerCase()!=='.png')throw new Error('Güvenli PNG çıkış yolu gerekli');
 const target=path.resolve(outputPath);
 fs.mkdirSync(path.dirname(target),{recursive:true});
 // scrot captures the entire virtual desktop, including extension-owned Chrome UI.
 await runner('scrot',['-o',target],{env:{...process.env,DISPLAY:display},timeout:20000});
 if(!fs.existsSync(target))throw new Error('Ekran görüntüsü kaydedilmedi');
 if(validateImage){
  const meta=await require('sharp')(target).metadata();
  if(meta.format!=='png'||meta.width!==1600||meta.height!==900){
   fs.rmSync(target,{force:true});
   throw new Error('Xvfb 1600x900x24 çalışmalı; yanlış masaüstü çözünürlüğü');
  }
 }
 return target;
}
module.exports={captureDesktop};
