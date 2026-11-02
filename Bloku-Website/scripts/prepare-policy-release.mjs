// Prepare a policy-only Build Output API deployment. Never changes the source dist.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cp, mkdir, readFile, readdir, lstat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';

const website=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.dirname(website);
const args=process.argv.slice(2);
assert.equal(args.length,4,'Use --baseline DIRECTORY --output EMPTY_DIRECTORY');
assert.equal(args[0],'--baseline');assert.equal(args[2],'--output');
const baseline=path.resolve(args[1]),output=path.resolve(args[3]);
assert.notEqual(baseline,output);
try {assert.equal((await readdir(output)).length,0,'Output must be empty; existing releases are never replaced.');} catch(error){if(error.code!=='ENOENT')throw error;}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const manifest=JSON.parse(await readFile(path.join(baseline,'baseline-manifest.json'),'utf8'));
assert.equal(manifest.deploymentId,'dpl_2qGLLKMzfgYS87WCscXkqfkGGDUo');
assert.equal(manifest.projectId,'prj_Wx9myW6YY9CrHAhOUBxH4e9A8SSy');
assert.equal(manifest.files.length,11);
const staticDir=path.join(output,'.vercel/output/static');
await mkdir(staticDir,{recursive:true});
const preserved={};
for(const file of manifest.files){
  assert.ok(!file.path.startsWith('/')&&!file.path.split('/').some(part=>!part||part==='..'||part==='.'||part.startsWith('.env')));
  const source=path.join(baseline,'baseline',file.path);
  assert.ok((await lstat(source)).isFile()&&!(await lstat(source)).isSymbolicLink());
  const bytes=await readFile(source);assert.equal(sha(bytes),file.sha256,'Baseline changed: '+file.path);
  await mkdir(path.dirname(path.join(staticDir,file.path)),{recursive:true});
  await cp(source,path.join(staticDir,file.path));preserved[file.path]=file.sha256;
}
const product=JSON.parse(await readFile(path.join(root,'shared/product.json'),'utf8'));
const transition=JSON.parse(await readFile(path.join(website,'scripts/policy-transition-copy.json'),'utf8'));
assert.equal(product.locales.length,8);
assert.deepEqual(Object.keys(transition).sort(),product.locales.map(locale=>locale.code).sort());
const oldConfig=JSON.parse(await readFile(path.join(baseline,'baseline-vercel.json'),'utf8'));
assert.deepEqual(oldConfig.rewrites,[{source:'/(.*)',destination:'/index.html'}],'Review changed production routing before preparing a bridge.');

const css=`:root{color-scheme:light dark;--bg:#faf7f3;--fg:#241a1d;--muted:#62545a;--line:#d8cbd0;--accent:#8b1230}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:1.0625rem/1.7 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:var(--accent);text-underline-offset:.2em;overflow-wrap:anywhere}a:hover{text-decoration-thickness:.14em}a:focus-visible{outline:3px solid var(--accent);outline-offset:5px;border-radius:2px}header,main,footer{width:min(76ch,calc(100% - 3rem));margin-inline:auto}header{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding-block:1.5rem;border-bottom:1px solid var(--line)}.brand{display:inline-flex;align-items:center;gap:.7rem;font-weight:800;font-size:1.35rem;text-decoration:none;color:var(--fg)}.brand img{width:36px;height:36px}.skip{position:absolute;inset-inline-start:1rem;top:-10rem}.skip:focus{top:1rem;background:var(--bg);padding:.6rem;z-index:1}main{padding-block:2.7rem 1rem}h1{font-size:clamp(2rem,6vw,3rem);line-height:1.2;letter-spacing:-.035em;margin:.3rem 0 1rem;overflow-wrap:anywhere}h2{font-size:1.35rem;line-height:1.35;margin:0 0 .8rem}p{margin:.8rem 0 1.25rem;overflow-wrap:anywhere}.version,.updated{font-size:.9rem;color:var(--muted)}.version{color:var(--accent);font-weight:700;letter-spacing:.05em}.scope{border-inline-start:3px solid var(--accent);padding-inline-start:1rem}.languages{display:flex;flex-wrap:wrap;gap:.35rem 1rem;padding-block:1rem 1.6rem;border-bottom:1px solid var(--line)}.languages a{font-size:.9rem}.languages a[aria-current]{font-weight:700}section{padding-block:1.8rem;border-bottom:1px solid var(--line)}footer{padding-block:1.5rem 3rem;color:var(--muted);font-size:.9rem}footer p{margin:.6rem 0}.policy-links{display:flex;gap:.5rem 1rem;flex-wrap:wrap}@media(prefers-color-scheme:dark){:root{--bg:#100d0b;--fg:#f5f0ea;--muted:#c3b5ac;--line:#493b36;--accent:#f395b0}}@media(max-width:360px){header,main,footer{width:calc(100% - 2rem)}header{align-items:flex-start;flex-wrap:wrap}}`;
const cssPath=`privacy-assets/policy-${sha(css).slice(0,16)}.css`;
await mkdir(path.join(staticDir,'privacy-assets'),{recursive:true});
await writeFile(path.join(staticDir,cssPath),css);
// The retained site's React Router must not render its bundled, obsolete policy.
// Intercept only same-origin policy navigation; other website behavior is retained.
const bridge=`(()=>{const policy=p=>/^(?:\\/(?:ar|es|pt-br|pt-BR|fr|de|ja|hi|en))?\\/privacy(?:\\.html)?\\/?$/.test(p);document.addEventListener('click',e=>{if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;const a=e.target.closest?.('a[href]');if(!a||a.hasAttribute('download')||(a.target&&a.target!=='_self'))return;const u=new URL(a.href,location.href);if(u.origin===location.origin&&policy(u.pathname)){e.preventDefault();e.stopImmediatePropagation();location.assign(u.href);}},true);for(const name of ['pushState','replaceState']){const original=history[name];history[name]=function(state,title,url){if(url!=null){const u=new URL(url,location.href);if(u.origin===location.origin&&policy(u.pathname)){location.assign(u.href);return;}}return original.apply(this,arguments);};}addEventListener('popstate',()=>{if(policy(location.pathname))location.reload();});})();`;
const bridgePath=`privacy-assets/navigation-${sha(bridge).slice(0,16)}.js`;
await writeFile(path.join(staticDir,bridgePath),bridge);
const oldIndex=await readFile(path.join(staticDir,'index.html'),'utf8');
assert.equal(oldIndex.split('</head>').length,2);
const bridgeTag=`<script src="/${bridgePath}"></script>`;
const newIndex=oldIndex.replace('</head>',bridgeTag+'</head>');
assert.equal(newIndex.replace(bridgeTag,''),oldIndex);
await writeFile(path.join(staticDir,'index.html'),newIndex);
const policyText=await readFile(path.join(root,'B2/PRIVACY_POLICY.v2.md'));
await writeFile(path.join(staticDir,'privacy-assets/bloku-2.0-policy.txt'),policyText);
const routes=[];const policies=[];
const policyCsp="default-src 'none'; style-src 'self'; img-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
for(const locale of product.locales){
  const prefix=locale.path?'/'+locale.path:'';const route=prefix+'/privacy';
  const sourcePath=path.join(website,'dist',locale.path,'privacy.html');
  const source=await readFile(sourcePath,'utf8');const doc=new JSDOM(source).window.document;
  const sections=[...doc.querySelectorAll('.document-sections section')].map(node=>({title:node.querySelector('h2')?.textContent,body:node.querySelector('p')?.textContent}));
  assert.equal(sections.length,7,'Expected six privacy sections and optional PayPal disclosure.');
  assert.ok(sections.every(section=>section.title&&section.body));
  assert.deepEqual(Object.keys(transition[locale.code]).sort(),['legacy','legacyTitle','scope','website']);
  sections[2].body=transition[locale.code].website;
  sections.splice(4,0,{title:transition[locale.code].legacyTitle,body:transition[locale.code].legacy});
  const title=doc.querySelector('h1')?.textContent;assert.ok(title);
  const updated=doc.querySelector('.updated')?.textContent;assert.ok(updated);
  const homeLabel=doc.querySelector('.brand-link')?.getAttribute('aria-label');assert.ok(homeLabel);
  const supportLabel=doc.querySelector('footer a[href$="/support"]')?.textContent;assert.ok(supportLabel);
  const skipLabel=doc.querySelector('a[href="#main-content"]')?.textContent;assert.ok(skipLabel);
  const canonical='https://bloku.app'+route;
  const alternates=product.locales.map(other=>`<link rel="alternate" hreflang="${escape(other.tag)}" href="https://bloku.app${other.path?'/'+other.path:''}/privacy"/>`).join('');
  const languages=product.locales.map(other=>`<a lang="${escape(other.tag)}" href="${other.path?'/'+other.path:''}/privacy"${other.code===locale.code?' aria-current="page"':''}>${escape(other.label)}</a>`).join('');
  const sectionHtml=sections.map(section=>`<section><h2>${escape(section.title)}</h2><p>${escape(section.body)}</p></section>`).join('');
  const html=`<!doctype html><html lang="${escape(locale.tag)}" dir="${escape(locale.dir)}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escape(title)} — BLOKU 2.0</title><meta name="description" content="${escape(transition[locale.code].scope)}"/><link rel="canonical" href="${canonical}"/>${alternates}<link rel="alternate" hreflang="x-default" href="https://bloku.app/privacy"/><meta name="robots" content="index,follow"/><link rel="stylesheet" href="/${cssPath}"/><link rel="icon" href="/favicon.ico"/></head><body><a class="skip" href="#main-content">${escape(skipLabel)}</a><header><a class="brand" href="/" aria-label="${escape(homeLabel)}"><img src="/assets/bloku-logo-BR7p6vPg.png" alt="" width="36" height="36"/>BLOKU</a><a href="/support">${escape(supportLabel)}</a></header><main id="main-content"><p class="version">BLOKU 2.0</p><h1>${escape(title)}</h1><p class="updated">${escape(updated)}</p><p class="scope">${escape(transition[locale.code].scope)}</p><nav class="languages">${languages}</nav>${sectionHtml}<div class="policy-links"><p><a href="https://policies.google.com/privacy">Google · Privacy</a></p><p><a href="https://www.paypal.com/webapps/mpp/ua/privacy-full">PayPal · Privacy</a></p></div></main><footer><p><a href="/privacy-assets/bloku-2.0-policy.txt">BLOKU 2.0 · TXT</a> · <a href="mailto:support@bloku.app">support@bloku.app</a></p><p>© 2026 BLOKU · <a href="https://frameless.com.eg">Frameless</a></p></footer></body></html>`;
  const parsed=new JSDOM(html).window.document;assert.equal(parsed.querySelectorAll('script,iframe,form').length,0);
  assert.ok(!html.includes('googletagmanager.com')&&!html.includes('frameless.co/'));
  const filename=(locale.path?locale.path+'/':'')+'privacy.html';
  await mkdir(path.dirname(path.join(staticDir,filename)),{recursive:true});await writeFile(path.join(staticDir,filename),html);
  routes.push({src:'^'+route+'$',dest:'/'+filename,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=0, must-revalidate','Content-Security-Policy':policyCsp}});
  routes.push({src:'^'+route+'\\.html$',status:308,headers:{Location:route}});
  policies.push({locale:locale.code,path:route,file:filename,sha256:sha(html),sourceHtmlSha256:sha(source),sections:sections.length});
}
for(const route of ['/en/privacy','/en/privacy.html','/pt-BR/privacy','/pt-BR/privacy.html'])routes.push({src:'^'+route.replaceAll('.','\\.')+'$',status:308,headers:{Location:route.includes('pt-BR')?'/pt-br/privacy':'/privacy'}});
// Vercel defaults routes to case-insensitive matching. Without this flag the
// canonical lowercase Portuguese route consumes /pt-BR before its redirect.
for(const route of routes)route.caseSensitive=true;
// Preserve the existing website's security/cache headers, static files and SPA fallback.
const globalHeaders=Object.fromEntries(oldConfig.headers.find(rule=>rule.source==='/(.*)').headers.map(({key,value})=>[key,value]));
assert.equal(oldConfig.trailingSlash,false);
const oldHeaders=oldConfig.headers.filter(rule=>rule.source!=='/(.*)').map(rule=>({src:'^'+rule.source.replace('/:path*','(?:/(.*))?')+'$',headers:Object.fromEntries(rule.headers.map(({key,value})=>[key,value])),continue:true}));
const config={version:3,routes:[{src:'^/(.*)$',headers:globalHeaders,continue:true},{src:'^/(.+)/$',status:308,headers:{Location:'/$1'}},...routes,{src:'^/privacy-assets/(.*)\\.txt$',headers:{'Cache-Control':'public, max-age=0, must-revalidate'},continue:true},{src:'^/privacy-assets/(.*)\\.(css|js)$',headers:{'Cache-Control':'public, max-age=31536000, immutable'},continue:true},...oldHeaders,{handle:'filesystem'},{src:'^/(.*)$',dest:'/index.html'}]};
await writeFile(path.join(output,'.vercel/output/config.json'),JSON.stringify(config,null,2)+'\n');
const before={...preserved};delete before['index.html'];for(const [relative,digest] of Object.entries(before))assert.equal(sha(await readFile(path.join(staticDir,relative))),digest,'Non-policy public asset changed.');
await writeFile(path.join(output,'policy-release-manifest.json'),JSON.stringify({kind:'POLICY_ONLY_STAGING_NOT_PUBLISHED',baselineDeploymentId:manifest.deploymentId,baselineProjectId:manifest.projectId,preservedPublicFiles:before,indexNavigationBridge:{baselineSha256:preserved['index.html'],updatedSha256:sha(newIndex),script:bridgePath,scriptSha256:sha(bridge),onlyChange:bridgeTag},policies,packagedPolicySha256:sha(policyText),stylesheet:cssPath,configSha256:sha(JSON.stringify(config,null,2)+'\n'),limits:['Full V2 marketing is not promoted. Old marketing/analytics remains disclosed during transition.','Ten existing public assets remain byte-identical. The HTML shell gains only a same-origin policy-navigation bridge.','Existing non-policy SPA fallback is preserved; this is not full V2 website qualification.','No extension package, certifications or Store submission is changed.']},null,2)+'\n');
console.log(JSON.stringify({status:'POLICY_ONLY_STAGING_READY',policies:policies.length,preservedFiles:Object.keys(preserved).length,output}));
