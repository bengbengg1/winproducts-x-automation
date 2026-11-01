"use strict";
// Never invent products or metrics. Deterministic daily editorial selection from a trusted export.
const fs=require('node:fs');
const path=require('node:path');
const {planDay,validatePost}=require('./editorial');
const ROOT=path.resolve(__dirname,'..');
const BANK=require('../data/content-bank.json');
const EXPORT=process.env.WINPRODUCTS_RESEARCH_FILE||path.join(ROOT,'data','research-candidates.json');
const HISTORY=path.join(ROOT,'state','selected-research.json');
function readJson(file,fallback){return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):fallback;}
function inside(file){const real=path.resolve(ROOT,file||'');if(!real.startsWith(ROOT+path.sep))throw new Error('Kaynak dosya proje disinda: '+file);return real;}
function isSafeUrl(value){try{const u=new URL(value);return u.protocol==='https:' && Boolean(u.hostname) && !u.username && !u.password;}catch{return false;}}
function daysBetween(a,b){return Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000);}
function accepted(c,date,category,history){
 if(!c || !c.approved || !c.id || !['stores','products','ads','tips'].includes(c.category) || c.category!==category)return false;
 if(!/^[\w.-]{2,90}$/.test(c.id) || !c.productName || !c.storeName || !isSafeUrl(c.productUrl) || !isSafeUrl(c.storeUrl))return false;
 if(!Array.isArray(c.evidence)||!c.evidence.length||!c.evidence.every(x=>isSafeUrl(x.url)&&x.summary&&x.checkedAt))return false;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(c.checkedAt||''))return false;
 const age=daysBetween(c.checkedAt,date);
 if(age<0||age>14)return false;
 // Hold an entire store out for 30 days, not only an individual product.
 if(Object.entries(history).some(([d,h])=>d!==date && daysBetween(d,date)>=0 && daysBetween(d,date)<30 && (h.id===c.id||h.storeUrl===c.storeUrl)))return false;
 return true;
}
function score(c,date){
 const s=c.signals||{};
 const bounded=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));
 const fresh=1-Math.max(0,daysBetween(c.checkedAt,date))/14;
 const growth=bounded(s.trafficGrowthPct,-50,200)/200;
 const variety=bounded(s.activeAds,0,30)/30;
 const evidence=bounded(c.evidence.length,1,4)/4;
 return +(fresh*30+growth*25+variety*15+evidence*20+bounded(s.editorialPriority,0,10)).toFixed(2);
}
function pickCandidate(date,category,{file=EXPORT,historyFile=HISTORY}={}){
 const items=readJson(file,null);if(!items||!Array.isArray(items.records))throw new Error('Gercek arastirma akisi yok: data/research-candidates.json ya da yetkili WinProducts export gereklidir.');
 const history=readJson(historyFile,{});
 if(history[date]){const same=items.records.find(c=>c.id===history[date].id);if(!same)throw new Error('Bugunun kilitlenmis urunu exporttan kayboldu');return same;}
 const candidates=items.records.filter(c=>accepted(c,date,category,history)).sort((a,b)=>score(b,date)-score(a,date)||a.id.localeCompare(b.id));
 if(!candidates.length)throw new Error(`${date} ${category}: dogrulanmis, yeni ve onayli urun bulunamadi. Gercek icerik yoksa yayin yok.`);
 return candidates[0];
}
function buildDay(date,startDate,{file=EXPORT,historyFile=HISTORY}={}){
 const base=planDay(date,startDate,BANK);
 if(base.length!==2)throw new Error('Bu gun icin iki yayin bulunamadi');
 const category=base[0].category;
 const c=pickCandidate(date,category,{file,historyFile});
 if(!c.screenshots || !c.screenshots.linked || !c.screenshots.plain || c.captureMethod!=='winproducts-chrome-extension')throw new Error('Gercek eklentili ekran goruntuleri eksik. capture-extension aracini kullanin.');
 if(c.screenshotApproved!==true)throw new Error('Ekran goruntusu dogrulamasi/izni eksik');
 if(c.captureOrigin!=='x11-full-desktop')throw new Error('Chrome yan panelini kapsayan gerçek ekran kaynağı doğrulanmadı');
 for(const slot of ['linked','plain']){const p=inside(c.screenshots[slot]);if(!fs.existsSync(p))throw new Error('Gercek ekran goruntusu bulunamadi: '+p);}
 const insight=String(c.insight||'').trim();if(!insight||insight.length>110)throw new Error('Kisa ve kaynakli insight gerekli');
 const shortName=String(c.productName).trim(), storeName=String(c.storeName).trim();
 const baseUrl=base[0].text.match(/https:\/\/\S+/)[0];
 const linkedText=`${storeName} mağazasındaki ${shortName} ürününü inceledik.\n\n${insight}\n\nKaynaklı analiz ve ürün araştırması 👇\n${baseUrl}`;
 const plainText=`Bugünkü araştırmada ${shortName} ürününe baktık.\n\n${String(c.takeaway||insight).trim()}\n\nBir ürünün popülerliği, tek başına kârlılık garantisi değildir.`;
 const posts=base.map((p,i)=>({...p,text:i===0?linkedText:plainText,sourceScreenshot:c.screenshots[i===0?'linked':'plain'],sourceType:'real-extension-screenshot',productId:c.id,sourceDate:c.checkedAt,visualApproved:true}));
 posts.forEach(validatePost);
 return {candidate:c,posts};
}
function lockSelection(date,candidate,{historyFile=HISTORY}={}){
 const history=readJson(historyFile,{});
 if(history[date] && history[date].id!==candidate.id)throw new Error('Gun icindeki secilmis urun degistirilemez');
 history[date]={id:candidate.id,storeUrl:candidate.storeUrl};
 fs.mkdirSync(path.dirname(historyFile),{recursive:true});
 fs.writeFileSync(historyFile,JSON.stringify(history,null,2)+'\n','utf8');
}
module.exports={pickCandidate,buildDay,lockSelection,accepted,score};
