'use strict';
// WinProducts' own deterministic, source-aware 16:9 compositor.
// No generative image prompt is allowed to invent metrics or storefronts.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const ROOT = path.resolve(__dirname, '..');
const WIDTH = 1600, HEIGHT = 900;
const KEYS = {
  stores: { name: 'SHOPIFY MAĞAZA ANALİZİ', color: '#64e7b3', checks: ['Trafik trendi', 'Ürün / teklif uyumu', 'Satış sayfası'] },
  products: { name: 'VİRAL ÜRÜN ARAŞTIRMASI', color: '#85c5fb', checks: ['Talep sinyali', 'Rakip ürünler', 'Fiyatlandırma'] },
  ads: { name: 'META REKLAM ANALİZİ', color: '#e1bdff', checks: ['İlk 3 saniye', 'Reklam mesajı', 'Landing page'] },
  tips: { name: 'E-TİCARET TAKTİĞİ', color: '#f8cd87', checks: ['Müşteri ihtiyacı', 'Teklif netliği', 'Dönüşüm yolu'] }
};
function xml(s){ return String(s ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;'); }
function wrapWords(text, max=39, limit=3){
  const words=String(text).replace(/https?:\/\/\S+/g,'').replace(/\s+/g,' ').trim().split(' ');
  const lines=[]; let line='';
  for(const w of words){
    if ((line+' '+w).trim().length>max && line){lines.push(line);line=w;}else{line=(line+' '+w).trim();}
    if (lines.length>=limit){break;}
  }
  if(lines.length<limit && line) lines.push(line);
  if(lines.length>limit) lines.length=limit;
  if (words.join(' ').length > lines.join(' ').length) lines[limit-1]=lines[limit-1].replace(/[.…]+$/,'').slice(0,max-2).trimEnd()+'…';
  return lines;
}
function caption(post){ const noUrl=post.text.replace(/https?:\/\/\S+/g,'').trim(); return wrapWords(noUrl,41,2); }
function escapePath(file){const full=path.resolve(ROOT,file);if(!full.startsWith(ROOT+path.sep))throw new Error('Görsel dosya yolu proje dışına çıkamaz');return full;}
function getCurated(post, opts={}){
  const db=opts.researchFile||path.join(ROOT,'data','visual-research.json');
  if(!fs.existsSync(db))return null;
  const data=JSON.parse(fs.readFileSync(db,'utf8'));
  if(!Array.isArray(data.records))throw new Error('visual-research.json: records dizisi gerekli');
  const match=data.records.find(r=>r.postId===post.id);
  if(!match) return null;
  if(match.approved!==true)throw new Error(`Görsel veri kaydı onaysız: ${post.id}`);
  if(match.category!==post.category)throw new Error(`Görsel kategori uyuşmuyor: ${post.id}`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(match.asOf||''))throw new Error('Görsel araştırma tarihini YYYY-MM-DD girin');
  const shots={};
  for(const [key,field] of [['store','storeScreenshot'],['panel','panelScreenshot']]){
    if(match[field]){
      const file=escapePath(match[field]);
      if(!fs.existsSync(file))throw new Error(`Görsel bulunamadı: ${field}`);
      if(!/\.(png|jpg|jpeg|webp)$/i.test(file))throw new Error('Görsel PNG/JPG/WEBP olmalı');
      shots[key]=file;
    }
  }
  if(!shots.store && !shots.panel)throw new Error('En az bir gerçek ekran görüntüsü gerekli');
  return { ...match, shots };
}
function svgBox(x,y,w,h,fill,rx=20,stroke='none'){
 return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}"/>`;
}
function svgText(x,y,text,size=28,fill='#ecf3f7',weight=500){return `<text x="${x}" y="${y}" fill="${fill}" font-family="DejaVu Sans, Arial" font-weight="${weight}" font-size="${size}">${xml(text)}</text>`;}
async function imagePanel(file,x,y,w,h,position='attention'){
  const buf=await sharp(file,{limitInputPixels:30000000}).rotate().resize(w,h,{fit:'cover',position}).png().toBuffer();
  return {input:buf,left:x,top:y};
}
async function renderPost(post,{outputDir=path.join(ROOT,'assets','generated'),researchFile}={}){
  const key=KEYS[post.category];
  if(!key) throw new Error(`Kategori yok: ${post.category}`);
  // Production requires a REAL extension-opened browser screenshot, no illustrative fallback.
  if(process.env.ALLOW_ILLUSTRATIVE_PREVIEW!=='true'){
    if(post.sourceType!=='real-extension-screenshot'||post.visualApproved!==true||!post.sourceScreenshot)
      throw new Error(`Gercek eklentili ekran goruntusu yok: ${post.id}. Sablon resim yayinlanmaz.`);
    const screenshot=escapePath(post.sourceScreenshot);
    if(!fs.existsSync(screenshot))throw new Error('Eklentili ekran goruntusu dosyasi eksik: '+screenshot);
    const info=await sharp(screenshot).metadata();
    if(info.width!==WIDTH||info.height!==HEIGHT)throw new Error('Gercek ekran goruntusu tam 1600x900 olmalidir');
    fs.mkdirSync(outputDir,{recursive:true});
    const output=path.join(outputDir,post.id+'.png');
    await sharp(screenshot).png({compressionLevel:8}).toFile(output);
    const imageSha256=crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex');
    return {image:path.relative(ROOT,output).replaceAll(path.sep,'/'),imageSha256,
      alt:`${post.productId||'Shopify urunu'}: gercek urun sayfasi ve acik WinProducts Chrome eklentisi analiz panelinin ekran goruntusu.`,sourceType:'real-extension-screenshot'};
  }
  const record=getCurated(post,{researchFile});
  const accent=key.color;
  const text=caption(post);
  const hasShot=!!record;
  const title=record?.title?wrapWords(record.title,37,2):text;
  let b='';
  b+=svgBox(0,0,WIDTH,HEIGHT,'#0b1015',0);
  b+=svgBox(42,40,1516,818,'#111820',34,'#27323c');
  b+=`<circle cx="89" cy="93" r="20" fill="#164633" stroke="${accent}" stroke-width="2"/>`;
  b+=svgText(125,102,'WinProducts',30,'#f5fafb',800);
  b+=svgBox(1171,67,336,43,'#1d2d32',16);
  b+=svgText(1187,97,key.name,15,accent,700);
  title.forEach((s,i)=>{b+=svgText(74,164+i*56,s,43,'#f5f7fa',800);});
  const leftX=74,leftY=306,leftW=922,leftH=465,rightX=1018,rightY=306,rightW=510,rightH=465;
  b+=svgBox(leftX,leftY,leftW,leftH,'#f0f4f5',21);
  b+=svgBox(rightX,rightY,rightW,rightH,'#182129',21,'#33424b');
  if(!record?.shots.store){
    b+=svgBox(95,331,880,54,'#d9e5e8',10);
    for(let j=0;j<3;j++) b+=`<circle cx="${123+j*24}" cy="359" r="7" fill="${['#ed8b8b','#e8c581','#85c5ad'][j]}"/>`;
    b+=svgText(211,366,'ÜRÜN / MAĞAZA İNCELEMESİ',18,'#3e5562',700);
    b+=svgBox(107,419,365,293,'#d3e3e3',18);
    b+=svgBox(139,448,302,170,'#c4d7db',16);
    b+=`<circle cx="283" cy="530" r="61" fill="#afc9cd" opacity="0.8"/>`;
    b+=`<path d="M207 583 L277 501 L331 558 L366 535 L426 612 L207 612 Z" fill="#94b9bc"/>`;
    b+=svgBox(503,437,427,22,'#9eb1ba',6);
    b+=svgBox(503,482,351,17,'#c1ced2',6);
    b+=svgBox(503,518,402,17,'#c1ced2',6);
    b+=svgBox(503,554,262,17,'#c1ced2',6);
    b+=svgBox(503,627,311,59,'#91d5b4',10);
    b+=svgText(539,664,'Araştırma görünümü',20,'#204f3d',700);
  }
  b+=svgText(1046,360,'WinProducts  /  ANALİZ',23,'#ecf5f4',800);
  b+=svgText(1046,401,record?.name||'İnceleme başlıkları',19,'#c7d4db',500);
  if(record && Array.isArray(record.metrics) && record.metrics.length){
    const metrics=record.metrics.slice(0,3);
    metrics.forEach((m,i)=>{
      const yy=434+i*87;
      b+=svgBox(1044,yy,454,73,'#202d36',11);
      b+=svgText(1061,yy+25,String(m.label||'Veri').slice(0,27),15,'#a0b1bc',500);
      b+=svgText(1061,yy+56,String(m.value||'').slice(0,18),25,accent,800);
    });
    b+=svgText(1046,737,`Tahmini veri / ${record.asOf}`,15,'#adbac2',500);
  }else{
    key.checks.forEach((s,i)=>{
      const yy=448+i*87;
      b+=svgBox(1044,yy,454,73,'#202d36',11);
      b+=`<circle cx="1073" cy="${yy+36}" r="12" fill="#204839"/>`;
      b+=`<path d="M1067 ${yy+36} l5 5 l8 -10" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>`;
      b+=svgText(1102,yy+45,s,23,'#e1eced',600);
    });
    b+=svgText(1045,737,record?.shots.panel?`Kaynak tarihi: ${record.asOf} • Tahmini göstergeler`:'Metrik paylaşılmadı  •  Örnek şablon',14,'#a5b4be',500);
  }
  b+=svgText(78,823,record?'Kaynak: Onaylı mağaza ekran görüntüleri':'İçerik şablonu • Gerçek mağaza verisi sunulmadı',17,'#a1b4bc',500);
  b+=svgText(1264,823,post.kind==='linked'?'WINPRODUCTS.IO':'E-TİCARET İÇGÖRÜSÜ',15,accent,700);
  const base=Buffer.from(`<svg width="1600" height="900" xmlns="http://www.w3.org/2000/svg">${b}</svg>`);
  const layers=[];
  if(record?.shots.store)layers.push(await imagePanel(record.shots.store,89,400,888,334));
  if(record?.shots.panel){
    // Source screenshot displayed inside the metric area, never recreated with made-up numbers.
    layers.push(await imagePanel(record.shots.panel,1041,417,458,310,'north'));
  }
  const filename=post.id+'.png';
  fs.mkdirSync(outputDir,{recursive:true});
  const filepath=path.join(outputDir,filename);
  await sharp(base).composite(layers).png({compressionLevel:8}).toFile(filepath);
  const imageSha256=crypto.createHash('sha256').update(fs.readFileSync(filepath)).digest('hex');
  return {image:path.relative(ROOT,filepath).replaceAll(path.sep,'/'),alt:`WinProducts ${key.name.toLocaleLowerCase('tr-TR')}; ${text.join(' ')}. ${record?'Onaylı araştırma görseli.':'Gerçek satış rakamı içermez.'}`,imageSha256,sourceType:hasShot?'approved-screenshots':'illustrative-template'};
}
async function renderPosts(posts,opts={}){
  const rendered=[];
  for(const post of posts)rendered.push({...post,...await renderPost(post,opts)});
  return rendered;
}
module.exports={renderPost,renderPosts,getCurated,KEYS,WIDTH,HEIGHT};
