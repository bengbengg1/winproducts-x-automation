'use strict';
// Official X API publisher. One media attachment per post, no browser automation.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {validatePost}=require('./editorial');
const ROOT=path.resolve(__dirname,'..');
const TWEETS=process.env.TWEETS_FILE||path.join(ROOT,'data','tweets.json');
const STATE=process.env.STATE_FILE||path.join(ROOT,'state','post-history.json');
const LOG=process.env.LOG_FILE||path.join(ROOT,'logs','tweet-log.jsonl');
function readJson(file,fallback){return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):fallback;}
function writeJson(file,obj){fs.mkdirSync(path.dirname(file),{recursive:true});const t=file+'.tmp';fs.writeFileSync(t,JSON.stringify(obj,null,2)+'\n');fs.renameSync(t,file);}
function log(event,payload={}){fs.mkdirSync(path.dirname(LOG),{recursive:true});fs.appendFileSync(LOG,JSON.stringify({at:new Date().toISOString(),event,...payload})+'\n');}
function isLive(){return process.env.PUBLISH_ENABLED==='true'&&!process.argv.includes('--dry-run');}
function env(name){const val=process.env[name];if(!val)throw new Error(`Eksik GitHub Secret: ${name}`);return val;}
function twitterClient(){const {TwitterApi}=require('twitter-api-v2');return new TwitterApi({appKey:env('X_API_KEY'),appSecret:env('X_API_KEY_SECRET'),accessToken:env('X_ACCESS_TOKEN'),accessSecret:env('X_ACCESS_TOKEN_SECRET')}).readWrite;}
function verifyImage(post){
 if(!post.image || !post.alt || typeof post.alt!=='string')throw new Error(`Tweet ${post.id} için tam 1 görsel ve ALT metni gerekli`);
 const file=path.resolve(ROOT,post.image);
 if(!file.startsWith(ROOT+path.sep))throw new Error('Proje dışındaki görsel yasak');
 if(!fs.existsSync(file)||path.extname(file).toLowerCase()!=='.png')throw new Error(`PNG görsel eksik: ${post.image}`);
 const body=fs.readFileSync(file);
 if(!body.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error('Geçersiz PNG');
 if(body.length>5*1024*1024)throw new Error('Görsel X boyut limitini aştı (5 MB)');
 const digest=crypto.createHash('sha256').update(body).digest('hex');
 if(post.imageSha256 && post.imageSha256!==digest)throw new Error(`Görsel hash uyuşmuyor: ${post.id}`);
 if(post.alt.length>1000)throw new Error('ALT metni 1000 karakteri aşamaz');
 return {file,digest,body};
}
async function sendWithImage(api,post,image){
 // Modern X v2 media upload, then tweet with exactly one media ID.
 const mediaId=await api.v2.uploadMedia(image.body,{media_type:'image/png'});
 if(!mediaId)throw new Error('X media upload ID eksik');
 await api.v2.createMediaMetadata(mediaId,{alt_text:{text:post.alt}});
 const result=await api.v2.tweet({text:post.text,media:{media_ids:[mediaId]}});
 return result?.data?.id;
}
async function main({now=new Date(),client=null,live=isLive()}={}){
 const payload=readJson(TWEETS,null);
 if(!payload||!Array.isArray(payload.tweets)||payload.tweets.length!==2)throw new Error('Önce npm run prepare: tam 2 gönderi gerekli');
 const posts=payload.tweets;
 if(new Set(posts.map(p=>p.id)).size!==2||posts.filter(p=>p.kind==='linked').length!==1||posts.filter(p=>p.kind==='plain').length!==1)throw new Error('Tam 1 URL ve 1 URL’siz gönderi gerekli');
 posts.forEach(validatePost);
 // The development-only illustrative renderer can never be published live.
 if(live && posts.some(p=>p.sourceType!=='real-extension-screenshot'||p.visualApproved!==true))
   throw new Error('Canli yayinda yalnizca dogrulanmis gercek eklenti ekran goruntusu kullanilabilir');
 // Validate the full daily manifest before any billable action.
 const images=posts.map(verifyImage);
 const state=readJson(STATE,{});
 const limit=Number(process.env.MAX_LATE_MINUTES||90);
 if(!Number.isFinite(limit)||limit<0)throw new Error('MAX_LATE_MINUTES geçersiz');
 let posted=0,planned=0,skipped=0;
 for(let i=0;i<posts.length;i++){
   const post=posts[i],image=images[i];
   const dueMs=new Date(post.schedule_at).getTime();
   if(!Number.isFinite(dueMs))throw new Error('Geçersiz zaman');
   const diff=(now.getTime()-dueMs)/60000;
   // Uncertain attempts are quarantined: retry requires manual verification, not re-posting.
   if(state[post.id]){skipped++;log('skip',{id:post.id,reason:state[post.id].status||'already_posted'});continue;}
   if(diff<0){skipped++;log('skip',{id:post.id,reason:'not_due'});continue;}
   if(diff>limit){skipped++;log('skip',{id:post.id,reason:'expired'});continue;}
   if(!live){planned++;log('preview',{id:post.id,image:post.image});console.log(`[ÖNİZLEME ${post.id}] ${post.text}\nGörsel: ${post.image}\n`);continue;}
   const api=client||(client=twitterClient());
   // Persist before network call. Failure may mean X received tweet but we did not get the ID.
   // We prefer manual investigation over an accidental duplicate/cost.
   state[post.id]={status:'uncertain',attemptedAt:new Date().toISOString(),contentHash:crypto.createHash('sha256').update(post.text+'|'+image.digest).digest('hex')};
   writeJson(STATE,state);
   try{
     const tweetId=await sendWithImage(api,post,image);
     if(!tweetId)throw new Error('X API yanıtında Tweet ID yok');
     state[post.id]={...state[post.id],status:'posted',tweetId,postedAt:new Date().toISOString()};
     writeJson(STATE,state);log('posted',{id:post.id,tweetId});posted++;
   }catch(error){log('error',{id:post.id,error:error.message,status:'uncertain'});throw error;}
 }
 const counts={posted,planned,skipped,live};console.log(JSON.stringify(counts));return counts;
}
if(require.main===module)main().catch(e=>{console.error('X gönderim hatası:',e.message);process.exitCode=1;});
module.exports={main,verifyImage,sendWithImage};
