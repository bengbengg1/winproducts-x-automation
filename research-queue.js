'use strict';
// Operates on a local human-curated set of real Shopify product links. No WinProducts API.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {istanbulDate}=require('./editorial');
const FILE=path.resolve(__dirname,'../data/research-candidates.json');
function arg(args,key,required=true){const i=args.indexOf(key);const v=i<0?null:args[i+1];if(required&&!v)throw new Error('Eksik parametre: '+key);return v;}
function validShopUrl(input){
 const u=new URL(input);
 if(u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.')||u.hostname==='example.com')throw new Error('Geçerli HTTPS Shopify URL girilmeli');
 u.hash='';return u.toString();
}
function read(file=FILE){return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{records:[]};}
function add({productUrl,storeName,productName,category='stores',insight='',takeaway='',approved=false,file=FILE,date=istanbulDate(new Date())}){
 if(!['stores','products','ads','tips'].includes(category))throw new Error('Kategori hatalı');
 const url=validShopUrl(productUrl);
 if(!/\/products\//.test(new URL(url).pathname))throw new Error('Ürün sayfası /products/ yolunu içermeli');
 if(!String(storeName||'').trim()||!String(productName||'').trim())throw new Error('Mağaza ve ürün adları gerekli');
 const storeUrl=new URL('/',url).toString();
 const id='p-'+crypto.createHash('sha256').update(url).digest('hex').slice(0,14);
 const db=read(file);
 if(!Array.isArray(db.records))throw new Error('Kuyruk biçimi bozuk');
 const existing=db.records.find(x=>x.id===id);
 if(existing)return {record:existing,added:false};
 const record={id,category,approved,productName:productName.trim(),storeName:storeName.trim(),productUrl:url,storeUrl,checkedAt:date,insight:insight.trim(),takeaway:takeaway.trim(),signals:{},evidence:[{url,summary:'Mağazanın ürün sayfası; metrik doğrulanmadı',checkedAt:date}],captureMethod:null,screenshotApproved:false,screenshots:{}};
 db.records.push(record);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(db,null,2)+'\n','utf8');
 return {record,added:true};
}
function annotate({id,insight,takeaway,file=FILE}){
 const db=read(file),r=db.records?.find(x=>x.id===id);
 if(!r)throw new Error('Kayıt bulunamadı');
 if(insight && insight.length>110)throw new Error('Kısa içgörü en fazla 110 karakter olmalı');
 if(insight)r.insight=insight;
 if(takeaway)r.takeaway=takeaway;
 fs.writeFileSync(file,JSON.stringify(db,null,2)+'\n','utf8');
 return r;
}
async function approve({id,file=FILE,confirmed=false}){
 if(!id)throw new Error('--id gerekli');
 const db=read(file),r=db.records?.find(x=>x.id===id);
 if(!r)throw new Error('Kayıt bulunamadı');
 if(!r.screenshots?.linked||!r.screenshots?.plain||r.captureMethod!=='winproducts-chrome-extension'||r.captureOrigin!=='x11-full-desktop')throw new Error('Gerçek eklenti görüntüleri eksik');
 if(!confirmed)throw new Error('Yayın öncesi her iki gerçek görüntüyü incelediğinizi --confirm-real-panel ile onaylayın');
 const sharp=require('sharp');
 const root=path.resolve(__dirname,'..');
 for(const key of ['linked','plain']){
  const img=path.resolve(root,r.screenshots[key]);
  if(!img.startsWith(root+path.sep)||!fs.existsSync(img))throw new Error('Görsel yok veya kök dışında: '+key);
  const m=await sharp(img).metadata();
  if(m.width!==1600||m.height!==900||m.format!=='png')throw new Error('Gerçek 1600x900 PNG gerekli: '+key);
 }
 if(!r.insight||!r.takeaway)throw new Error('Kaynaklı insight ve takeaway gerekli; rakam uydurmayın');
 r.approved=true;r.screenshotApproved=true;r.approvedAt=new Date().toISOString();
 fs.writeFileSync(file,JSON.stringify(db,null,2)+'\n','utf8');
 return r;
}
async function cli(args=process.argv){
 const command=args[2];
 if(command==='add'){
  const {record,added}=add({productUrl:arg(args,'--url'),storeName:arg(args,'--store'),productName:arg(args,'--product'),category:arg(args,'--category',false)||'stores',insight:arg(args,'--insight',false)||'',takeaway:arg(args,'--takeaway',false)||''});
  console.log(JSON.stringify({added,id:record.id,product:record.productName,status:'Görsel alınmadan yayınlanamaz'},null,2));
 }else if(command==='approve'){
  const r=await approve({id:arg(args,'--id'),confirmed:args.includes('--confirm-real-panel')});
  console.log(`Onaylandı: ${r.id}. Bu kayıt yalnızca kaynaklı gerçek görüntülerle yayımlanabilir.`);
 }else if(command==='annotate'){
  const r=annotate({id:arg(args,'--id'),insight:arg(args,'--insight',false),takeaway:arg(args,'--takeaway',false)});
  console.log('İçgörü güncellendi: '+r.id);
 }else if(command==='list'){
  const db=read();console.table((db.records||[]).map(x=>({id:x.id,category:x.category,product:x.productName,captured:!!x.screenshots?.linked,approved:x.approved&&x.screenshotApproved})));
 }else throw new Error('Kullanım: node src/research-queue.js add|approve|list ...');
}
if(require.main===module)cli().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={add,approve,annotate,read,validShopUrl};
