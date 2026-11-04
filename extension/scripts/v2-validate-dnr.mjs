import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(await readFile(path.join(root,'dist/manifest.json'),'utf8'));
let total=0;
for(const resource of manifest.declarative_net_request.rule_resources){
 const rules=JSON.parse(await readFile(path.join(root,'dist',resource.path),'utf8'));
 const ids=new Set();
 for(const rule of rules){
  if(!Number.isInteger(rule.id)||rule.id<1||ids.has(rule.id)||!rule.action||!rule.condition)throw new Error(`Invalid rule in ${resource.id}`);
  ids.add(rule.id);
 }
 total+=rules.length;
}
console.log(JSON.stringify({status:'STATIC_SCHEMA_PASS',lists:manifest.declarative_net_request.rule_resources.length,packagedRules:total,note:'Browser acceptance and filter semantics are tested by the engine gate; optional lists need available Chrome capacity.'}));
