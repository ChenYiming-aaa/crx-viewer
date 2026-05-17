import{readdirSync,existsSync,readFileSync}from'fs';import{join}from'path';

const BROWSERS=[
  {name:'Chrome',base:join(process.env.LOCALAPPDATA||'','Google','Chrome','User Data')},
  {name:'Edge',base:join(process.env.LOCALAPPDATA||'','Microsoft','Edge','User Data')},
];

function resolveName(manifest, extPath) {
  const name = manifest.name || '';
  const m = name.match(/__MSG_(.+?)__/);
  if (!m) return name;
  const key = m[1];
  try {
    const localeDir = join(extPath, '_locales');
    if (!existsSync(localeDir)) return name;
    const dirs = readdirSync(localeDir);
    const preferred = ['zh_CN', 'zh-CN', 'en', 'en_US'];
    for (const want of preferred) {
      if (!dirs.includes(want)) continue;
      const msgFile = join(localeDir, want, 'messages.json');
      if (!existsSync(msgFile)) continue;
      const msgs = JSON.parse(readFileSync(msgFile, 'utf-8'));
      if (msgs[key] && msgs[key].message) return msgs[key].message;
    }
    for (const d of dirs) {
      const msgFile = join(localeDir, d, 'messages.json');
      if (!existsSync(msgFile)) continue;
      const msgs = JSON.parse(readFileSync(msgFile, 'utf-8'));
      if (msgs[key] && msgs[key].message) return msgs[key].message;
    }
  } catch {}
  return name;
}

export function scanAllLocalExtensions(){const exts=[];
for(const{name:browser,base}of BROWSERS){let profiles;
  try{if(!existsSync(base))continue;profiles=readdirSync(base)}catch{continue}
  for(const profile of profiles){if(profile==='System Profile'||profile==='Guest Profile')continue;
    const extDir=join(base,profile,'Extensions');let ids;
    try{if(!existsSync(extDir))continue;ids=readdirSync(extDir)}catch{continue}
    for(const id of ids){if(id.length<32)continue;let versions;
      try{versions=readdirSync(join(extDir,id))}catch{continue}
      for(const version of versions){const extPath=join(extDir,id,version);
        const mf=join(extPath,'manifest.json');
        try{if(!existsSync(mf))continue;const raw=readFileSync(mf,'utf-8');const manifest=JSON.parse(raw);
          exts.push({id,name:resolveName(manifest,extPath),version:manifest.version||version,path:extPath,browser,profile});
        }catch{}
        break;
      }
    }
  }
}
return exts;}
