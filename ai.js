'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {BASE_URLS,validatePost,urls}=require('./editorial');
const ROOT=path.resolve(__dirname,'..');
const FEED=path.join(ROOT,'data','verified-research.json');
function chooseRecord(category,dayIndex){
  if(!fs.existsSync(FEED)) return null;
  const parsed=JSON.parse(fs.readFileSync(FEED,'utf8'));
  if(!parsed || !Array.isArray(parsed.records)) throw new Error('verified-research.json içinde records dizisi olmalı');
  const record=parsed.records.filter(r => r && r.category===category && Array.isArray(r.facts) && r.facts.length > 0);
  if (!record.length) return null;
  const item=record[Math.floor(dayIndex)%record.length];
  // Only share intentionally published, human-approved facts.
  if (!item.approved) return null;
  return {name:String(item.name||'').slice(0,100),asOf:String(item.asOf||'').slice(0,10),facts:item.facts.map(v=>String(v).slice(0,200)).slice(0,8)};
}
function parseOutput(result){
  const text=result.output_text||result.output?.filter(i=>i.type==='message').flatMap(i=>(i.content||[]).filter(j=>j.type==='output_text').map(j=>j.text)).join('')||'';
  const cleaned=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const obj=JSON.parse(cleaned);
  if(typeof obj.linked!=='string'||typeof obj.plain!=='string')throw new Error('AI yanıtında linked/plain metinleri bulunamadı');
  return obj;
}
function noUnsupportedMetrics(text,record){
  const numeric=text.match(/\d[\d.,]*\s*(?:%|\$|₺|TL|USD|milyon|bin)?/gi)||[];
  // Avoid ungrounded quantitative claims; numeric enumerations of steps are not necessary.
  const permitted=(record?.facts||[]).join(' ');
  for(const snippet of numeric) if(!permitted.includes(snippet.trim())) return false;
  return true;
}
async function writeWithAi(posts,category,dayIndex,fetchImpl=fetch){
  const key=process.env.OPENAI_API_KEY;
  if(!key) throw new Error('AI_ENABLED=true ama OPENAI_API_KEY Secret eksik');
  const record=chooseRecord(category,dayIndex);
  const task={date:posts[0].id.slice(0,8),category,record,guide:{linked:posts[0].text.split('\n\nhttps:')[0],plain:posts[1].text}};
  const instruction=`WinProducts marka hesabı için TÜRKÇE sosyal medya editörüsün. Yanıtın sadece JSON {"linked":"...","plain":"..."} olsun. Bağlantı veya @kullanıcı adı ekleme. İki metin birbirinden farklı olsun. Her biri en fazla 155 karakter olsun. Birincisi mağaza/ürün/reklam araştırması için merak uyandırsın, ikincisi bağımsız bir e-ticaret çıkarımı anlatsın. Gözlemi olgu diye sunma. Verilen APPROVED facts haricinde marka adı, müşteri sayısı, tarih, ciro, reklam harcaması, istatistik veya başka rakam uydurma. Her iki metni verili rehberden farklı şekilde yaz; kopya tweet üretme. Reklam kokan abartılı vaat ve emojiyi abartma.`;
  const response=await fetchImpl('https://api.openai.com/v1/responses',{
    method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},
    body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',instructions:instruction,input:JSON.stringify(task),store:false,max_output_tokens:400})
  });
  if(!response.ok) throw new Error(`AI API yanıtı: HTTP ${response.status}`);
  const obj=parseOutput(await response.json());
  if(urls(obj.linked).length||urls(obj.plain).length)throw new Error('AI beklenmedik URL ekledi');
  if(!noUnsupportedMetrics(obj.linked,record)||!noUnsupportedMetrics(obj.plain,record))throw new Error('AI doğrulanmamış sayı ekledi');
  const link=posts[0].text.match(/https:\/\/[^\s]+/)[0];
  const rewritten=[{...posts[0],text:obj.linked.trim()+'\n\n'+link},{...posts[1],text:obj.plain.trim()}];
  rewritten.forEach(validatePost);
  return rewritten;
}
module.exports={chooseRecord,parseOutput,noUnsupportedMetrics,writeWithAi};
