'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {istanbulDate,planDay}=require('./editorial');
const ROOT=path.resolve(__dirname,'..');
const CAMPAIGN=path.join(ROOT,'state','campaign.json');
const BANK=path.join(ROOT,'data','content-bank.json');
const OUT=path.join(ROOT,'data','tweets.json');
const YAML=path.join(ROOT,'data','tweets.yaml');
function readJson(file,fallback){return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):fallback;}
function writeAtomic(file,content){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp';fs.writeFileSync(tmp,content);fs.renameSync(tmp,file);}
function toYaml(posts){return 'timezone: "Europe/Istanbul"\ntweets:\n'+posts.map(p=>
  `  - number: ${JSON.stringify(p.id)}\n    schedule_at: ${JSON.stringify(p.schedule_at)}\n    text: ${JSON.stringify(p.text)}\n    images:\n      - path: ${JSON.stringify('../'+(p.image||'NOT_RENDERED.png'))}\n        alt: ${JSON.stringify(p.alt||'WinProducts analizi')}\n`).join('');}
function prepare({today,preview=false}={}) {
  const day=today||istanbulDate(new Date());
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||new Date(day).toISOString().slice(0,10)!==day)throw new Error('Geçersiz YYYY-MM-DD tarih');
  const bank=readJson(BANK,[]);
  const campaign=readJson(CAMPAIGN,null);
  const startDate=campaign?.startDate||day;
  const posts=planDay(day,startDate,bank);
  if(!preview){
    if(!campaign)writeAtomic(CAMPAIGN,JSON.stringify({startDate},null,2)+'\n');
    writeAtomic(OUT,JSON.stringify({timezone:'Europe/Istanbul',tweets:posts},null,2)+'\n');
    writeAtomic(YAML,toYaml(posts));
  }
  return {date:day,startDate,preview,posts};
}
async function runCli({argv=process.argv,outputDir=null}={}){
  const preview=argv.includes('--preview');
  const dateFlag=argv.indexOf('--date');
  const day=dateFlag>=0?argv[dateFlag+1]:istanbulDate(new Date());
  // Reuse the original day's AI copy, but re-render images on ephemeral GH runners.
  const existing=readJson(OUT,null);
  const sameDay=!preview&&existing&&Array.isArray(existing.tweets)&&existing.tweets.length===2 && existing.tweets.every(p=>p.id.startsWith(day.replace(/-/g,'')));
  const result=prepare({today:day,preview:true});
  const realMode=process.env.ALLOW_ILLUSTRATIVE_PREVIEW!=='true';
  let researchCandidate=null;
  if(sameDay) { result.posts=existing.tweets; result.reused=true; }
  else if(realMode){
    const {buildDay}=require('./research');
    const researched=buildDay(day,result.startDate);
    result.posts=researched.posts;
    researchCandidate=researched.candidate;
  }
  else if(process.env.AI_ENABLED==='true' && (!preview||argv.includes('--ai-preview'))){
    const bank=readJson(BANK,[]);
    const index=Math.round((Date.parse(day+'T00:00:00Z')-Date.parse(result.startDate+'T00:00:00Z'))/86400000);
    const {writeWithAi}=require('./ai');
    try {result.posts=await writeWithAi(result.posts,bank[index].category,index);result.ai=true;}
    catch(error){console.warn('AI yerine editoryal içerik:',error.message);result.ai=false;}
  }
  const {renderPosts}=require('./visuals');
  const imageOut=outputDir||path.join(ROOT,preview?'previews/'+day:'assets/generated');
  result.posts=await renderPosts(result.posts,{outputDir:imageOut});
  // Only lock the chosen subject after both genuine screenshots rendered successfully.
  if(researchCandidate&&!preview){require('./research').lockSelection(day,researchCandidate);}
  if(preview){
    const file=path.join(imageOut,'preview-posts.json');
    writeAtomic(file,JSON.stringify({date:day,posts:result.posts},null,2)+'\n');
    result.previewFile=file;
  } else {
    if(!fs.existsSync(CAMPAIGN))writeAtomic(CAMPAIGN,JSON.stringify({startDate:result.startDate},null,2)+'\n');
    writeAtomic(OUT,JSON.stringify({timezone:'Europe/Istanbul',tweets:result.posts},null,2)+'\n');
    writeAtomic(YAML,toYaml(result.posts));
  }
  return result;
}
if(require.main===module)runCli().then(r=>console.log(JSON.stringify({date:r.date,startDate:r.startDate,preview:r.preview,reused:r.reused||false,posts:r.posts.map(p=>({id:p.id,schedule_at:p.schedule_at,image:p.image,sourceType:p.sourceType,text:p.text})),previewFile:r.previewFile},null,2))).catch(e=>{console.error('İçerik/görsel hazırlanamadı:',e.message);process.exitCode=1;});
module.exports={prepare,toYaml,runCli};
