'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {planDay}=require('../src/editorial');
const bank=require('../data/content-bank.json');
const ROOT=path.resolve(__dirname,'..');
process.on('exit',()=>{try{fs.unlinkSync(path.join(ROOT,'assets/generated/TEST-PIXEL.png'));}catch{}});
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/x9kAAAAASUVORK5CYII=','base64');
function runner({missingImage=false,badHash=false}={}){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'wp-x-test-'));
 const picRel='assets/generated/TEST-PIXEL.png';
 const pic=path.join(ROOT,picRel); fs.mkdirSync(path.dirname(pic),{recursive:true});fs.writeFileSync(pic,pixel);
 process.env.TWEETS_FILE=path.join(tmp,'tweets.json');
 process.env.STATE_FILE=path.join(tmp,'state.json');
 process.env.LOG_FILE=path.join(tmp,'log.jsonl');
 const posts=planDay('2026-11-01','2026-11-01',bank).map(p=>({...p,
   image:missingImage?'assets/generated/NOT_PRESENT.png':picRel,
   alt:'WinProducts örnek görseli',sourceType:'real-extension-screenshot',visualApproved:true,imageSha256:badHash?'bad':crypto.createHash('sha256').update(pixel).digest('hex')
 }));
 fs.writeFileSync(process.env.TWEETS_FILE,JSON.stringify({tweets:posts}));
 delete require.cache[require.resolve('../src/index')];
 return {main:require('../src/index').main,tmp,posts};
}
function mockApi({failOnTweet=false}={}){
 const calls=[];
 return {calls,v2:{
  uploadMedia:async(image,opts)=>{calls.push({op:'media',length:image.length,opts});return 'MEDIA-100';},
  createMediaMetadata:async(id,meta)=>{calls.push({op:'alt',id,meta});},
  tweet:async(payload)=>{calls.push({op:'tweet',payload});if(failOnTweet)throw new Error('connection reset');return {data:{id:String(calls.filter(c=>c.op==='tweet').length)}};}
 }};
}
test('publish only due posts; exactly one image and ALT per tweet; no duplicates',async()=>{
 const {main,tmp}=runner();const client=mockApi();
 const first=await main({now:new Date('2026-11-01T09:35:00Z'),client,live:true});
 assert.equal(first.posted,1);
 const second=await main({now:new Date('2026-11-01T16:35:00Z'),client,live:true});
 assert.equal(second.posted,1);
 const third=await main({now:new Date('2026-11-01T16:40:00Z'),client,live:true});
 assert.equal(third.posted,0);
 assert.deepEqual(client.calls.map(c=>c.op),['media','alt','tweet','media','alt','tweet']);
 assert.equal(client.calls[2].payload.media.media_ids.length,1);
 const state=JSON.parse(fs.readFileSync(path.join(tmp,'state.json')));
 assert.equal(Object.keys(state).length,2);assert.equal(state['20261101-URL'].status,'posted');
});
test('late posts are not dumped onto the account',async()=>{
 const {main}=runner();const client=mockApi();
 const r=await main({now:new Date('2026-11-02T04:00:00Z'),client,live:true});
 assert.equal(r.posted,0);assert.equal(r.skipped,2);assert.equal(client.calls.length,0);
});
test('dry-run never writes posted state and needs no X API keys',async()=>{
 const {main,tmp}=runner();const r=await main({now:new Date('2026-11-01T09:45:00Z'),live:false});
 assert.equal(r.planned,1);assert.equal(fs.existsSync(path.join(tmp,'state.json')),false);
});
test('missing image and changed image are rejected before publishing',async()=>{
 let v=runner({missingImage:true});await assert.rejects(v.main({now:new Date('2026-11-01T09:35:00Z'),client:mockApi(),live:true}),/PNG görsel eksik/);
 v=runner({badHash:true});await assert.rejects(v.main({now:new Date('2026-11-01T09:35:00Z'),client:mockApi(),live:true}),/hash uyuşmuyor/);
});
test('ambiguous network timeout is quarantined to prevent accidental double tweet',async()=>{
 const {main,tmp}=runner();const client=mockApi({failOnTweet:true});
 await assert.rejects(main({now:new Date('2026-11-01T09:35:00Z'),client,live:true}),/connection reset/);
 const state=JSON.parse(fs.readFileSync(path.join(tmp,'state.json')));
 assert.equal(state['20261101-URL'].status,'uncertain');
 const r=await main({now:new Date('2026-11-01T09:36:00Z'),client,live:true});
 assert.equal(r.posted,0);assert.equal(client.calls.filter(c=>c.op==='tweet').length,1);
});

test('live publisher refuses an illustrative template even with a valid PNG',async()=>{
 const {main,posts}=runner();
 posts[0].sourceType='illustrative-template';
 fs.writeFileSync(process.env.TWEETS_FILE,JSON.stringify({tweets:posts}));
 await assert.rejects(main({now:new Date('2026-11-01T09:35:00Z'),client:mockApi(),live:true}),/gercek eklenti/);
});
