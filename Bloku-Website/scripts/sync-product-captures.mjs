// Copy verified rendered Store screenshots; never retouch or synthesize product UI.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,lstat,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const website=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),root=path.dirname(website);
assert.equal(process.argv.length,3,'Pass one complete Store capture directory.');
const input=path.resolve(process.argv[2]),relative=path.relative(path.join(root,'artifacts/store'),input);
assert.ok(relative&&relative!=='..'&&!relative.startsWith(`..${path.sep}`)&&!path.isAbsolute(relative),'Use a capture beneath this workspace artifacts/store.');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=await readFile(path.join(input,'manifest.json')),manifest=JSON.parse(bytes);
const fingerprint=hash(await readFile(path.join(root,'B2/dist/checksums.json')));
assert.equal(manifest.package.checksumsManifestSha256,fingerprint,'Screenshots are from a different extension build.');
assert.deepEqual([...manifest.locales].sort(),['ar','de','en','es','fr','hi','ja','pt_BR']);
assert.deepEqual(manifest.errors,[]);assert.deepEqual(manifest.blockedExternalRequests,[]);
const selected=['01-protection','05-local-settings','02-distractions','04-schedules'],files={};
// Validate every required byte before changing public assets.
const copies=[];
for(const locale of manifest.locales)for(const shot of selected){
 const name=`${locale}/${shot}.jpg`,item=manifest.images.find(image=>image.path===name);
 assert.ok(item&&item.kind==='screenshot'&&item.width===1280&&item.height===800,`Missing qualified screenshot ${name}`);
 const source=path.join(input,name),stat=await lstat(source);assert.ok(stat.isFile()&&!stat.isSymbolicLink());
 const content=await readFile(source);assert.equal(hash(content),item.sha256,`Changed screenshot ${name}`);
 files[name]=item.sha256;copies.push({source,name});
}
for(const {source,name} of copies){const target=path.join(website,'public/product',name);await mkdir(path.dirname(target),{recursive:true});await copyFile(source,target);}
await writeFile(path.join(website,'public/product/provenance.json'),JSON.stringify({packageChecksumsSha256:fingerprint,source:'Rendered BLOKU 2.0 Store captures; actual extension UI on owned fixtures, not live user data or universal effectiveness evidence.',assetManifestSha256:hash(bytes),captureDirectory:path.relative(root,input).split(path.sep).join('/'),files},null,2)+'\n');
console.log(`Copied ${copies.length} unmodified localized screenshots from ${fingerprint}.`);
