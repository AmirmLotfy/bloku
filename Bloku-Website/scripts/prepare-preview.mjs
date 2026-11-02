import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cp,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const website=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.dirname(website),dist=path.join(website,'dist');
const destination=path.join(root,'.local','website-preview-deploy');
const staticDir=path.join(destination,'.vercel','output','static');
const manifest=JSON.parse(await readFile(path.join(dist,'route-manifest.json'),'utf8'));
assert.equal(manifest.length,96,'Build all localized routes before staging');
await rm(staticDir,{recursive:true,force:true});
await mkdir(staticDir,{recursive:true});
// Copy generated public files only. No environment, sources, caches or credentials.
for(const name of await readdir(dist))await cp(path.join(dist,name),path.join(staticDir,name),{recursive:true});
await writeFile(path.join(staticDir,'robots.txt'),'User-agent: *\nDisallow: /\n');
const sourceConfig=JSON.parse(await readFile(path.join(website,'vercel.json'),'utf8'));
const headers=sourceConfig.headers[0].headers;
const routes=[{src:'/(.*)',headers:Object.fromEntries([...headers,{key:'X-Robots-Tag',value:'noindex, nofollow, noarchive'}].map(({key,value})=>[key,value])),continue:true},
 {src:'/assets/(.*)',headers:{'Cache-Control':'public, max-age=31536000, immutable'},continue:true},
 {src:'/(.+)/',headers:{Location:'/$1'},status:308},
 {src:'/index.html',headers:{Location:'/'},status:308},
 {src:'/(.+)/index.html',headers:{Location:'/$1'},status:308},
 {src:'/(.+)\\.html',headers:{Location:'/$1'},status:308},
 ...manifest.map(({path:uri,file})=>({src:uri==='/'?'/':uri.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),dest:`/${file}`,headers:{'Content-Type':'text/html; charset=utf-8'}})),
 {handle:'filesystem'}, {src:'/(.*)',dest:'/404.html',status:404}];
await writeFile(path.join(destination,'.vercel','output','config.json'),JSON.stringify({version:3,routes},null,2)+'\n');
const project=JSON.parse(await readFile(path.join(website,'.vercel','project.json'),'utf8'));
assert.equal(project.projectId,'prj_Wx9myW6YY9CrHAhOUBxH4e9A8SSy','Wrong verified website project');
await writeFile(path.join(destination,'.vercel','project.json'),JSON.stringify(project)+'\n');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
await writeFile(path.join(destination,'preview-provenance.json'),JSON.stringify({kind:'unindexed-preview-only',routeCount:manifest.length,routeManifestSha256:sha(await readFile(path.join(dist,'route-manifest.json'))),changes:['robots.txt denies crawling','X-Robots-Tag on all preview responses','Build Output API routes mirror static clean URLs and actual 404']},null,2)+'\n');
console.log(`Prepared ${manifest.length} unindexed static routes at ${destination}`);
