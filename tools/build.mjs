import { prepareWechat } from './prepare-wechat.mjs';
import { prepareWebBranding } from './prepare-web-branding.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const platform=process.argv[2]||'web-desktop';
if(!['web-desktop','wechatgame'].includes(platform))throw new Error('Unsupported build target');
const creator=process.env.COCOS_CREATOR||'/Applications/Cocos/Creator/3.8.6/CocosCreator.app/Contents/MacOS/CocosCreator';
const testAppId='wx6ac3f5090a6b99c5';
const localConfig=path.join(project,'config','wechat.local.json');
const local=fs.existsSync(localConfig)?JSON.parse(fs.readFileSync(localConfig,'utf8')):{};
const appid=process.env.WECHAT_APP_ID||local.appid||testAppId;
fs.mkdirSync(path.join(project,'temp'),{recursive:true});
const logPath=path.join(project,'temp',`build-${platform}.log`);
const log=fs.openSync(logPath,'w');
const options=`platform=${platform};debug=${platform==='web-desktop'};name=maze-lab;outputName=${platform};startScene=abf55117-2369-4d42-8cd4-a3ca588c4ad2;`+
  (platform==='wechatgame'?`appid=${appid};orientation=landscape;separateEngine=false;`:'');
console.log(`Cocos ${platform} build. Log: ${logPath}`);
const child=spawn(creator,['--project',project,'--build',options],{stdio:['ignore',log,log]});
child.on('error',e=>{console.error(e);fs.closeSync(log);process.exitCode=1;});
child.on('exit',code=>{
  fs.closeSync(log);
  const out=path.join(project,'build',platform);
  const expected=path.join(out,platform==='wechatgame'?'game.js':'index.html');
  if(code===36&&fs.existsSync(expected)){
    if(platform==='web-desktop'){
      let html=fs.readFileSync(expected,'utf8');
      html=html.replace(/<title>.*?<\/title>/,'<title>Bomberman · 50关试玩</title>')
        .replace(/<h1 class="header">[\s\S]*?<\/h1>/,'')
        .replace(/<p class="footer">[\s\S]*?<\/p>/,'')
        .replace('cc_exact_fit_screen="false"','cc_exact_fit_screen="true"')
        .replace(/style="width: \d+px; height: \d+px;"/,'style="width:100vw;height:100vh"');
      fs.writeFileSync(expected,html);
      fs.writeFileSync(path.join(out,'style.css'),`html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#101921}*{box-sizing:border-box;touch-action:none;-webkit-user-select:none;user-select:none}#GameDiv{position:fixed;inset:0}#Cocos3dGameContainer,#GameCanvas{width:100%;height:100%}canvas{outline:none}`);
      prepareWebBranding(out);
    }
    if(platform==='wechatgame')console.log('WeChat package:',prepareWechat(out,{libVersion:local.libVersion||'latest',appid}));
    console.log(`Built: ${out}`);
    if(platform==='wechatgame')console.log(appid===testAppId?'Using legacy Cocos placeholder. This tool rejected it during import; choose your account test AppID in WeChat DevTools.':'Using configured AppID. Device preview is unverified. No upload or publication performed.');
  }else{console.error(`Build failed (Cocos exit ${code}). See ${logPath}`);process.exitCode=1;}
});
