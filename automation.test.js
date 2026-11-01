'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {planDay,validatePost,dateDiff,istanbulDate}=require('../src/editorial');
const {toYaml,prepare}=require('../src/prepare');
const bank=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../data/content-bank.json'),'utf8'));
test('30 unique content days with exactly one URL and one plain tweet',()=>{
 assert.ok(bank.length>=30);
 for(let i=0;i<30;i++) {
   const day=new Date(Date.UTC(2026,10,1+i)).toISOString().slice(0,10);
   const posts=planDay(day,'2026-11-01',bank);
   assert.equal(posts.length,2);
   assert.deepEqual(posts.map(p=>p.kind),['linked','plain']);
   posts.forEach(validatePost);
   assert.equal(posts[0].text.match(/https?:\/\//g).length,1);
   assert.equal((posts[1].text.match(/https?:\/\//g)||[]).length,0);
   assert.equal(posts[0].schedule_at,`${day}T12:30:00+03:00`);
   assert.equal(posts[1].schedule_at,`${day}T19:30:00+03:00`);
 }
});
test('date math and timezone',()=>{
 assert.equal(dateDiff('2026-11-01','2026-12-01'),30);
 assert.equal(istanbulDate('2026-10-31T22:00:00Z'),'2026-11-01');
});
test('preview is read-only',()=>{
 const a=prepare({today:'2026-11-01',preview:true});
 assert.equal(a.posts.length,2);
 const yaml=toYaml(a.posts);
 assert.ok(yaml.includes('Europe/Istanbul'));
 assert.ok(yaml.includes('20261101-URL'));
});
test('reject wrong url and length',()=>{
 assert.throws(()=>validatePost({id:'bad',kind:'plain',text:'visit https://elsewhere.com'}));
 assert.throws(()=>validatePost({id:'bad',kind:'linked',text:'hello'}));
 assert.throws(()=>validatePost({id:'bad',kind:'plain',text:'x'.repeat(281)}));
});
test('never repeats when content bank exhausted',()=>{
 assert.throws(()=>planDay('2027-01-01','2026-11-01',bank),/tükendi/);
});
