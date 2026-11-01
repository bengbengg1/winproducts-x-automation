'use strict';
const path=require('node:path');
const {captureDesktop}=require('./desktop-capture');
const out=path.resolve(__dirname,'../previews/desktop-diagnostic.png');
captureDesktop({outputPath:out}).then(()=>console.log('X11 ekran yakalama çalışıyor: '+out+' (WinProducts ekranı OLDUĞU iddia edilmez)')).catch(e=>{console.error(e.message);process.exitCode=1;});
