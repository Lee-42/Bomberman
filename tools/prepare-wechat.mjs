import fs from 'node:fs';import path from 'node:path';
/** Package the built resources bundle using Cocos 3.8's existing WeChat subpackage loader. */
export function prepareWechat(out,{libVersion='latest',appid}={}){
 const configPath=path.join(out,'project.config.json'),config=JSON.parse(fs.readFileSync(configPath,'utf8'));
 config.libVersion=libVersion;if(appid)config.appid=appid;config.compileType='game';config.setting={...config.setting,es6:false,enhance:false};
 fs.writeFileSync(configPath,JSON.stringify(config,null,2)+'\n');
 const bundleNames=['resources','internal'];
 for(const name of bundleNames){
  const original=path.join(out,'assets',name),subpackage=path.join(out,'subpackages',name);
  if(fs.existsSync(original)){fs.mkdirSync(path.dirname(subpackage),{recursive:true});if(fs.existsSync(subpackage))throw Error(`Both ${name} bundle locations exist`);fs.renameSync(original,subpackage);}
  if(!fs.existsSync(subpackage))throw Error(`Built ${name} bundle is missing`);
  fs.copyFileSync(path.join(subpackage,'index.js'),path.join(subpackage,'game.js'));
 }
 const engineDir=path.join(out,'cocos-js');
 fs.writeFileSync(path.join(engineDir,'game.js'),'// Engine modules are required by the main bootstrap after this package loads.\n');
 const bootstrapPath=path.join(out,'game.js');let bootstrap=fs.readFileSync(bootstrapPath,'utf8');
 if(!bootstrap.includes('startAfterEnginePackage')){
  const marker='var sysInfo = wx.getSystemInfoSync();';const offset=bootstrap.lastIndexOf(marker);
  if(offset<0)throw Error('Unknown Cocos WeChat bootstrap layout');
  bootstrap=bootstrap.slice(0,offset)+'function startAfterEnginePackage() {\n'+bootstrap.slice(offset)+"\n}\nwx.loadSubpackage({name: 'engine', success: startAfterEnginePackage, fail: (error) => console.error('Engine subpackage load failed', error)});\n";
  fs.writeFileSync(bootstrapPath,bootstrap);
 }
 const settingsPath=path.join(out,'src/settings.json'),settings=JSON.parse(fs.readFileSync(settingsPath,'utf8'));
 settings.assets.subpackages=Array.from(new Set([...(settings.assets.subpackages||[]),...bundleNames]));
 fs.writeFileSync(settingsPath,JSON.stringify(settings));
 const gamePath=path.join(out,'game.json'),game=JSON.parse(fs.readFileSync(gamePath,'utf8'));
 game.deviceOrientation='landscape';
 game.subpackages=[...(game.subpackages||[]).filter(p=>!bundleNames.includes(p.name)&&p.name!=='engine'),...bundleNames.map(name=>({name,root:`subpackages/${name}/`})),{name:'engine',root:'cocos-js/'}];
 fs.writeFileSync(gamePath,JSON.stringify(game,null,2)+'\n');
 const bytes=dir=>fs.readdirSync(dir,{withFileTypes:true}).reduce((n,e)=>n+(e.isDirectory()?bytes(path.join(dir,e.name)):fs.statSync(path.join(dir,e.name)).size),0);
 const total=bytes(out),resourceBytes=bytes(path.join(out,'subpackages/resources')),internalBytes=bytes(path.join(out,'subpackages/internal')),engineBytes=bytes(engineDir),mainBytes=total-resourceBytes-internalBytes-engineBytes;
 if(mainBytes>=4*1024*1024)throw Error(`WeChat main package still exceeds 4 MiB (${mainBytes} bytes)`);
 if(total>=20*1024*1024)throw Error('WeChat total package exceeds 20 MiB');
 return {mainBytes,resourceBytes,internalBytes,engineBytes,totalBytes:total,subpackages:[...bundleNames,'engine'],libVersion};
}
