'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const sharp=require('sharp');
const {captureDesktop}=require('../src/desktop-capture');
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'wp-desktop-'));
test('real side panel must be captured from X11 desktop, never page screenshot',async()=>{
 const dir=tmp(),target=path.join(dir,'shot.png');
 let invoked;
 try{
  const runner=async(cmd,args,opts)=>{invoked={cmd,args,opts};fs.writeFileSync(target,await sharp({create:{width:1600,height:900,channels:3,background:'#fafafa'}}).png().toBuffer());};
  await captureDesktop({outputPath:target,display:':77',platform:'linux',runner});
  assert.equal(invoked.cmd,'scrot');assert.deepEqual(invoked.args,['-o',target]);
  assert.equal(invoked.opts.env.DISPLAY,':77');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('desktop capture rejects unavailable screen and wrong dimensions',async()=>{
 const dir=tmp(),target=path.join(dir,'bad.png');
 try{
  await assert.rejects(captureDesktop({outputPath:target,display:'',platform:'linux'}),/DISPLAY yok/);
  const runner=async()=>fs.writeFileSync(target,await sharp({create:{width:1200,height:700,channels:3,background:'#fff'}}).png().toBuffer());
  await assert.rejects(captureDesktop({outputPath:target,display:':77',platform:'linux',runner}),/1600x900/);
  assert.equal(fs.existsSync(target),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
