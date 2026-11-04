import { mkdir, readFile, writeFile, cp, rm, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generated = path.join(root, 'engine/generated');
const output = path.join(root, 'dist');
const result = spawnSync(process.execPath, [path.join(root, 'scripts/v2-build-engine.mjs')], { cwd: root, stdio: 'inherit' });
if (result.status !== 0) throw new Error('Engine build failed.');
const report = JSON.parse(await readFile(path.join(generated, 'build-report.json'), 'utf8'));
if (report.gate) throw new Error('Gate fixtures must never ship.');
await rm(output, { recursive: true, force: true });
await cp(path.join(generated, 'runtime'), output, { recursive: true });
await cp(path.join(root, 'icons'), path.join(output, 'icons'), { recursive: true });
for(const size of [16,48,128]){const bytes=await readFile(path.join(output,`icons/icon-${size}.png`));if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.readUInt32BE(16)!==size||bytes.readUInt32BE(20)!==size)throw new Error(`Expected ${size}x${size} PNG icon`);}
await cp(path.join(root, 'src/locales'), path.join(output, 'locales'), { recursive: true });
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
manifest.declarative_net_request.rule_resources = JSON.parse(await readFile(path.join(generated, 'rule-resources.json'), 'utf8'));
if (manifest.declarative_net_request.rule_resources.some(resource => resource.id === 'ruleset_9000')) throw new Error('Gate rules leaked into package.');
await writeFile(path.join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
for (const name of ['popup', 'options']) await cp(path.join(root, `src/ui/${name}.html`), path.join(output, `${name}.html`));
await cp(path.join(root, 'src/blocked.html'), path.join(output, 'blocked.html'));
await cp(path.join(root, 'src/ui/styles.css'), path.join(output, 'styles.css'));
for (const [entry, name, format] of [['src/background.ts', 'background', 'esm'], ['src/content.ts', 'content', 'iife'], ['src/consent.ts', 'consent', 'esm'], ['src/ui/popup.ts', 'popup', 'esm'], ['src/ui/options.ts', 'options', 'esm'], ['src/blocked.ts', 'blocked', 'esm']]) {
  await build({ absWorkingDir: root, entryPoints: [path.join(root, entry)], outfile: path.join(output, `${name}.js`), bundle: true, format, target: 'chrome145', legalComments: 'external', logLevel: 'warning' });
}
for (const file of await readdir(path.join(root, 'src/locales'))) {
  if (!file.endsWith('.json')) continue;
  const locale = path.basename(file, '.json');
  const text = JSON.parse(await readFile(path.join(root, `src/locales/${file}`), 'utf8'));
  if (!text.name || text.name.length > 75 || !text.summary || text.summary.length > 132) throw new Error(`${locale}: localized manifest text exceeds Chrome limits.`);
  await mkdir(path.join(output, `_locales/${locale}`), { recursive: true });
  await writeFile(path.join(output, `_locales/${locale}/messages.json`), JSON.stringify({ extensionName: { message: text.name }, extensionDescription: { message: text.summary }, hideElement: { message: text.picker }, restoreElements: { message: text.restoreSite }, openPopup: { message: text.openPopup }, toggleProtection: { message: text.toggleProtection } }, null, 2));
}
await cp(path.join(root, '../LICENSE'), path.join(output, 'LICENSE'));
await cp(path.join(root, 'NOTICE.md'), path.join(output, 'NOTICE.md'));
await cp(path.join(root, 'PRIVACY.md'), path.join(output, 'PRIVACY_POLICY.md'));
await mkdir(path.join(output, 'third-party'), { recursive: true });
await cp(path.join(root, 'node_modules/@duckduckgo/autoconsent/LICENSE'), path.join(output, 'third-party/LICENSE.Autoconsent'));
await cp(path.join(generated, 'build-report.json'), path.join(output, 'engine/build-report.json'));
await cp(path.join(root, 'engine/vendor/sources.json'), path.join(output, 'engine/filter-sources.json'));
await cp(path.join(root, 'engine/INTEGRATION.md'), path.join(output, 'engine/INTEGRATION.md'));
const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const components = Object.entries(lock.packages).filter(([location]) => location).map(([location, data]) => ({ path: location, name: data.name ?? location.split('node_modules/').at(-1), version: data.version, license: data.license ?? 'See upstream package', dev: data.dev === true, optional: data.optional === true }));
await writeFile(path.join(output, 'SBOM.json'), `${JSON.stringify({ schemaVersion: 1, source: 'package-lock.json', root: { name: packageJson.name, version: packageJson.version, dependencies: packageJson.dependencies, devDependencies: packageJson.devDependencies }, components, knownAdvisories: [{ id: 'GHSA-mrhx-c7xc-m3w5', package: 'zod', status: 'Inherited upstream dependency; input bounds mitigate exposure, no incompatible major override. See engine/INTEGRATION.md.' }] }, null, 2)}\n`);
const checksums = {};
async function hashTree(directory) { for (const entry of await readdir(directory, { withFileTypes: true })) { const filename = path.join(directory, entry.name); if (entry.isDirectory()) await hashTree(filename); else checksums[path.relative(output, filename)] = createHash('sha256').update(await readFile(filename)).digest('hex'); } }
await hashTree(output);
await writeFile(path.join(output, 'checksums.json'), `${JSON.stringify(checksums, null, 2)}\n`);
console.log(`Built BLOKU ${manifest.version}: ${Object.keys(checksums).length} packaged files. No runtime filter downloads.`);
