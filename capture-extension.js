'use strict';
// Uses an actual installed WinProducts Chrome extension. Never fabricates the panel.
const fs=require('node:fs');
const path=require('node:path');
const {istanbulDate,planDay}=require('./editorial');
const {pickCandidate}=require('./research');
const {screenshotPair}=require('./extension-capture');
const {summarizeMetrics}=require('./insights');
const ROOT=path.resolve(__dirname,'..');
const RESEARCH=path.join(ROOT,'data','research-candidates.json');
const read=(f)=>JSON.parse(fs.readFileSync(f,'utf8'));
function selectRecord(date,id){
 if(!fs.existsSync(RESEARCH))throw new Error('Ürün kuyruğu boş. npm run research:add ile gerçek ürün URL’si ekleyin');
 const db=read(RESEARCH);
 if(!Array.isArray(db.records))throw new Error('research-candidates.json records dizisi eksik');
 if(id){const c=db.records.find(x=>x.id===id);if(!c)throw new Error('Ürün kimliği bulunamadı: '+id);return {db,record:c};}
 const campaign=fs.existsSync(path.join(ROOT,'state/campaign.json'))?read(path.join(ROOT,'state/campaign.json')):null;
 const category=planDay(date,campaign?.startDate||date,require('../data/content-bank.json'))[0].category;
 return {db,record:pickCandidate(date,category)};
}
async function capture({date=istanbulDate(new Date()),id,interactive=false,screenshotPairFn=screenshotPair}={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Geçersiz YYYY-MM-DD');
 const {db,record}=selectRecord(date,id);
 if(!record.productUrl?.startsWith('https://'))throw new Error('Gerçek HTTPS ürün sayfası gerekli');
 const pair=await screenshotPairFn({record,date,root:ROOT,interactive});
 // Capturing does NOT mean the screenshot was reviewed or authorized to publish.
 record.screenshots={linked:pair.linked,plain:pair.plain};
 if(pair.panelMetrics){
   record.panelMetrics=pair.panelMetrics;
   const summary=summarizeMetrics(pair.panelMetrics);
   if(summary&&!record.insight)record.insight=summary;
   if(summary&&!record.takeaway)record.takeaway='Trafik ve tahmini satış verileri tek başına kârlılığı kanıtlamaz.';
 }
 record.captureMethod='winproducts-chrome-extension';
 record.captureOrigin=pair.captureOrigin;
 if(record.captureOrigin!=='x11-full-desktop')throw new Error('Eklenti yan panelini kapsayan gerçek masaüstü çekimi doğrulanmadı');
 record.screenshotApproved=false;
 record.checkedAt=date;
 // Explicitly add a capture audit marker, not a fabricated traffic estimate.
 record.lastCapturedAt=new Date().toISOString();
 fs.writeFileSync(RESEARCH,JSON.stringify(db,null,2)+'\n','utf8');
 return {candidate:record.id,screenshots:pair,approvedForPublishing:false,next:'Review both screenshots, then run npm run research:approve -- --id '+record.id};
}
if(require.main===module){
 const args=process.argv;
 const value=(key)=>{const i=args.indexOf(key);return i<0?undefined:args[i+1];};
 capture({date:value('--date')||istanbulDate(new Date()),id:value('--id'),interactive:args.includes('--interactive')})
 .then(r=>console.log(JSON.stringify(r,null,2)))
 .catch(e=>{console.error('Gerçek eklentili görüntü alınamadı:',e.message);process.exitCode=1;});
}
module.exports={capture,selectRecord};
