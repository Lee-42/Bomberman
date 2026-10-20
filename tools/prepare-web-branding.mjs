import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

/** Keep the selected launcher artwork across Cocos rebuilds. */
export function prepareWebBranding(out){
 const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 const icon=fs.readFileSync(path.join(project,'branding/app-icon.png'));
 const filename=`app-icon-${createHash('sha256').update(icon).digest('hex').slice(0,12)}.png`;
 fs.writeFileSync(path.join(out,filename),icon);
 const htmlPath=path.join(out,'index.html');
 const html=fs.readFileSync(htmlPath,'utf8')
  .replace(/<link\b[^>]*\brel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]*>\s*/gi,'')
  .replace('</head>',`  <link rel="icon" type="image/png" href="./${filename}"/>\n    <link rel="apple-touch-icon" href="./${filename}"/>\n  </head>`);
 fs.writeFileSync(htmlPath,html);
 return filename;
}
