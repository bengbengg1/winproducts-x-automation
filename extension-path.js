'use strict';
/** Find the real WinProducts extension installed by the user in desktop Chrome.
 * The original official Web Store CRX can be installed by npm run extension:install.
 * Never copy personal browser cookies or embed credentials.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const EXTENSION_ID = 'maplianemjpbfdhnmfpjhbjnmimbncla';
function listDirs(p) {
  try {return fs.readdirSync(p,{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>path.join(p,d.name));}
  catch {return [];}
}
function roots({home=os.homedir(),platform=process.platform,env=process.env}={}){
  if(platform==='win32'){
    const local=env.LOCALAPPDATA || path.join(home,'AppData','Local');
    return [path.join(local,'Google','Chrome','User Data'),path.join(local,'Chromium','User Data'),path.join(local,'BraveSoftware','Brave-Browser','User Data')];
  }
  if(platform==='darwin'){
    return [path.join(home,'Library','Application Support','Google','Chrome'),path.join(home,'Library','Application Support','Chromium'),path.join(home,'Library','Application Support','BraveSoftware','Brave-Browser')];
  }
  return [path.join(home,'.config','google-chrome'),path.join(home,'.config','chromium'),path.join(home,'.config','BraveSoftware','Brave-Browser')];
}
function manifestMatches(p,{strict=false}={}){
  try {
    const manifest=JSON.parse(fs.readFileSync(path.join(p,'manifest.json'),'utf8'));
    if(!manifest.manifest_version || !manifest.name)return false;
    if(strict && !/winproducts/i.test(manifest.name) && !String(manifest.name).startsWith('__MSG_'))return false;
    return true;
  }catch {return false;}
}
function findExtension({override=process.env.WINPRODUCTS_EXTENSION_DIR,home,platform,env}={}) {
  if(override){
    const p=path.resolve(override);
    if(!manifestMatches(p)) throw new Error('WINPRODUCTS_EXTENSION_DIR klasöründe manifest.json bulunamadı');
    return {directory:p,origin:'manual'};
  }
  const cached=path.join(__dirname,'..','.extensions','winproducts');
  if(manifestMatches(cached,{strict:true}))return {directory:cached,origin:'official-web-store-cache'};
  const matches=[];
  for(const base of roots({home,platform,env})){
    const profiles=listDirs(base).filter(d=>/^(Default|Profile \d+)$/i.test(path.basename(d)));
    for(const profile of profiles){
      const installed=path.join(profile,'Extensions',EXTENSION_ID);
      for(const versionDir of listDirs(installed)) if(manifestMatches(versionDir,{strict:true}))matches.push({directory:versionDir,origin:'chrome-installed',profile:path.basename(profile)});
    }
  }
  matches.sort((a,b)=>b.directory.localeCompare(a.directory,undefined,{numeric:true}));
  if(matches[0])return matches[0];
  throw new Error(`WinProducts eklentisi bulunamadı (ID: ${EXTENSION_ID}). npm run extension:install ile resmi Chrome Web Store sürümünü indirin; veya WINPRODUCTS_EXTENSION_DIR belirtin.`);
}
module.exports={EXTENSION_ID,roots,findExtension,manifestMatches};
if(require.main===module){
  try{const found=findExtension();console.log(JSON.stringify(found,null,2));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
