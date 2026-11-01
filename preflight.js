'use strict';
const fs=require('node:fs');const path=require('node:path');const ROOT=path.resolve(__dirname,'..');
const {findExtension}=require('./extension-path');
const {read}=require('./research-queue');
const checks=[];function check(item,ok,info){checks.push({item,ok,info});}
try{const ext=findExtension();check('WinProducts Chrome eklentisi',true,ext.directory);}catch(e){check('WinProducts Chrome eklentisi',false,e.message);}
try{require.resolve('playwright');check('Playwright yüklü',true,'npm install sonrası hazır');}catch{check('Playwright yüklü',false,'npm install; npx playwright install chromium');}
const candidates=read().records||[];
check('Araştırma adayları',candidates.length>0,`${candidates.length} kayit`);
const approved=candidates.filter(c=>c.approved&&c.screenshotApproved&&c.captureOrigin==='x11-full-desktop'&&c.captureMethod==='winproducts-chrome-extension');
check('Linux/X11 ekran yakalama',process.platform==='linux'&&Boolean(process.env.DISPLAY),'Gerçek Chrome yan paneli için Xvfb + scrot + 1600x900 gereklidir');
check('Görüntüsü onaylanmış adaylar',approved.length>0,`${approved.length} kayit`);
check('GitHub bağlantısı',false,'Kullanıcı isteği gereği henüz kurulmadı');
check('X canlı paylaşım',process.env.PUBLISH_ENABLED==='true','Güvenli varsayılan: kapalı');
for(const c of checks)console.log((c.ok?'✓ ':'○ ')+c.item+' — '+c.info);
console.log('\nBu rapor gerçek eklentiyle canlı uçtan uca test yapıldığını iddia etmez.');
