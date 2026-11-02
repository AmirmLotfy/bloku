#!/usr/bin/env node
/** Package already-built BLOKU 2.0 candidates. Never builds or changes dist. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT = fileURLToPath(import.meta.url);
const B2 = path.resolve(path.dirname(SCRIPT), '..');
const ROOT = path.dirname(B2);
const VERSION = '2.0.0';
const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'hi', 'ja', 'pt_BR'];
const EPOCH = [1980, 1, 1, 0, 0, 0];
const REQUIRED_PACKAGE_FILES = [
  'manifest.json', 'checksums.json', 'LICENSE', 'NOTICE.md', 'PRIVACY_POLICY.md',
  'third-party/LICENSE.Autoconsent', 'engine/LICENSE.AdGuard',
  'engine/filter-sources.json', 'engine/build-report.json', 'SBOM.json',
];
const SOURCE_FILES = [
  'LICENSE', 'README.md', '.gitignore', 'B2/README.md', 'B2/NOTICE.v2.md', 'B2/PRIVACY_POLICY.v2.md',
  'B2/tsconfig.json', 'B2/package.json', 'B2/package-lock.json', 'B2/v2-manifest.json', 'B2/data/presets.json',
  'B2/scripts/v2-build-extension.mjs', 'B2/scripts/v2-build-engine.mjs',
  'B2/scripts/v2-update-filters.mjs', 'B2/scripts/v2-engine-gate.mjs',
  'B2/scripts/v2-migration-check.mjs', 'B2/scripts/v2-video-check.mjs', 'B2/scripts/v2-accessibility-check.mjs', 'B2/scripts/v2-ci-browser.mjs', 'B2/scripts/v2-dependency-audit.mjs', 'B2/scripts/v2-runtime-check.mjs', 'B2/scripts/v2-store-assets.mjs', 'B2/scripts/v2-public-qualification.mjs', 'B2/scripts/v2-release-artifacts.mjs', 'B2/scripts/v2-validate-dnr.mjs',
  'B2/engine/package.json', 'B2/engine/INTEGRATION.md', 'B2/engine/gate-fixture.txt', 'docs/RELEASE_ARTIFACTS.md', 'docs/STORE_ASSETS.md', 'docs/STORE_RELEASE.md', 'docs/PUBLIC_QUALIFICATION.md', 'docs/PERFORMANCE_REVIEW.md', 'docs/RUNTIME_QUALIFICATION.md', 'docs/VIDEO_QUALIFICATION.md', 'docs/RELEASE_NOTES.md', 'docs/ACCESSIBILITY.md', 'docs/MIGRATION_REPORT.md', 'docs/MAINTENANCE.md', '.github/workflows/bloku-qualification.yml',
];
SOURCE_FILES.push('docs/SUBMISSION_HANDOFF.md');
SOURCE_FILES.push('docs/AUDIT_SUMMARY_20261102.md');
SOURCE_FILES.push('docs/STORE_DISCLOSURE_REVIEW_20261102.md');
SOURCE_FILES.push('B2/scripts/v2-behavior-audit.mjs', 'B2/scripts/v2-ui-audit-setup.mjs', 'docs/AUDIT_ENGINE_POPUP_20261102.md', 'docs/AUDIT_EXTENSION_BEHAVIOR_20261102.md', 'docs/AUDIT_POPUP_LAYOUT_20261102.md', 'docs/AUDIT_WEBSITE_STORE_20261102.md');
const SOURCE_TREES = ['B2/src', 'B2/engine/vendor', 'B2/icons', 'B2/store', 'shared'];
const WEBSITE_FILES = [
  'LICENSE', 'Bloku-Website/README.md', 'Bloku-Website/package.json',
  'Bloku-Website/package-lock.json', 'Bloku-Website/index.html',
  'Bloku-Website/tsconfig.json', 'Bloku-Website/vite.config.ts',
  'Bloku-Website/eslint.config.js', 'Bloku-Website/vercel.json',
];
const WEBSITE_TREES = ['Bloku-Website/src', 'Bloku-Website/public', 'Bloku-Website/scripts', 'Bloku-Website/tests', 'shared'];
const EXECUTABLE_SOURCE_FILES = new Set(['B2/scripts/v2-release-artifacts.mjs']);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

function requireCondition(value, message) { if (!value) throw new Error(message); }
export function safePath(value) {
  requireCondition(typeof value === 'string' && value.length > 0, 'Empty or non-string relative path.');
  requireCondition(!/[\\\x00-\x1f]/.test(value) && !path.posix.isAbsolute(value) && !/^[a-zA-Z]:/.test(value), `Unsafe path: ${value}`);
  requireCondition(value.split('/').every(segment => segment && segment !== '.' && segment !== '..'), `Noncanonical path: ${value}`);
  return value;
}

function forbiddenPath(relative, { submission = false } = {}) {
  const segments = relative.split('/');
  if (segments.some(segment => ['backend', 'node_modules', '.git', '.vercel', '.ssr', '.cache', 'artifacts', 'dist', 'generated', 'gate-generated', 'gate-extension'].includes(segment))) return true;
  if (segments.some(segment => segment.startsWith('.env') || segment === '.DS_Store')) return true;
  if (/\.(?:pem|p12|pfx|key|har)$/i.test(relative) || /(?:^|\/)(?:credentials|secrets)\.[^/]+$/i.test(relative)) return true;
  if (submission && (/(?:^|[\/_.-])(?:gate|fixture|probe)(?:[\/_.-]|$)/i.test(relative) || /(?:ruleset_|filter_)9000(?:[\/_.-]|$)/.test(relative) || /\.(?:test|spec)\.[^/]+$/i.test(relative) || /\.(?:ts|tsx|map)$/i.test(relative))) return true;
  return false;
}

async function walk(directory, prefix = '') {
  const result = [];
  const stat = await lstat(directory);
  requireCondition(stat.isDirectory() && !stat.isSymbolicLink(), `Expected a real directory: ${prefix || path.basename(directory)}`);
  for (const item of (await readdir(directory)).sort(compare)) {
    const relative = safePath(prefix ? `${prefix}/${item}` : item);
    const absolute = path.join(directory, item);
    const info = await lstat(absolute);
    requireCondition(!info.isSymbolicLink(), `Symlink is not allowed in a release input: ${relative}`);
    if (info.isDirectory()) result.push(...await walk(absolute, relative));
    else { requireCondition(info.isFile(), `Nonregular release input: ${relative}`); result.push(relative); }
  }
  return result;
}

async function fileEntry(base, relative, mode = 0o644) {
  safePath(relative);
  const absolute = path.join(base, relative);
  const info = await lstat(absolute);
  requireCondition(info.isFile() && !info.isSymbolicLink(), `Not a regular release file: ${relative}`);
  const bytes = await readFile(absolute);
  return { path: relative, absolute, sha256: sha256(bytes), size: bytes.length, mode };
}

function assertNoHostPaths(bytes, relative) {
  // Generated metadata must never publish a workstation home directory.
  const text = bytes.toString('utf8');
  // Pinned upstream filters contain URL patterns such as /home/new/v*/api/.
  // Check actual workstation paths there without treating those URL filters as home directories.
  if(relative.startsWith('B2/engine/vendor/')||relative==='B2/scripts/v2-release-artifacts.mjs'){requireCondition(!text.includes(os.homedir()+path.sep), `Workstation path found in upstream input: ${relative}`);return;}
  requireCondition(!/(?:^|[\s(="'\x60])(?:\/Users\/[^/\s"']+\/|\/home\/[^/\s"']+\/|[A-Z]:\\Users\\)/m.test(text), `Host-specific path found in public text input: ${relative}`);
}

function glob(pattern, paths) {
  safePath(pattern);
  const regex = new RegExp(`^${pattern.split('*').map(part => part.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')).join('.*')}$`);
  return paths.filter(relative => regex.test(relative));
}

function manifestAssets(manifest, paths) {
  const references = new Set();
  const add = (value, label) => {
    if (value === undefined) return;
    requireCondition(typeof value === 'string', `Invalid asset at ${label}`);
    safePath(value);
    requireCondition(paths.includes(value), `Missing manifest asset ${value} (${label})`);
    references.add(value);
  };
  const icons = (value, label) => { if (typeof value === 'string') add(value, label); else for (const [size, file] of Object.entries(value || {})) add(file, `${label}.${size}`); };
  add(manifest.background?.service_worker, 'background.service_worker');
  for (const file of manifest.background?.scripts || []) add(file, 'background.scripts');
  add(manifest.action?.default_popup, 'action.default_popup');
  icons(manifest.action?.default_icon, 'action.default_icon');
  icons(manifest.icons, 'icons');
  add(manifest.options_page, 'options_page');
  add(manifest.options_ui?.page, 'options_ui.page');
  add(manifest.devtools_page, 'devtools_page');
  for (const [key, file] of Object.entries(manifest.chrome_url_overrides || {})) add(file, `chrome_url_overrides.${key}`);
  for (const [index, script] of (manifest.content_scripts || []).entries()) {
    for (const file of [...(script.js || []), ...(script.css || [])]) add(file, `content_scripts[${index}]`);
  }
  for (const file of manifest.sandbox?.pages || []) add(file, 'sandbox.pages');
  for (const resource of manifest.declarative_net_request?.rule_resources || []) {
    requireCondition(!/(?:^|_)9000$/.test(resource.id), 'Acceptance ruleset 9000 must not ship.');
    add(resource.path, `rule_resources.${resource.id}`);
  }
  for (const group of manifest.web_accessible_resources || []) {
    for (const pattern of group.resources || []) {
      const matches = glob(pattern, paths);
      requireCondition(matches.length > 0, `Unmatched web_accessible_resources pattern: ${pattern}`);
      matches.forEach(relative => references.add(relative));
    }
  }
  return references;
}

async function htmlAssets(dist, relative, paths) {
  const html = await readFile(path.join(dist, relative), 'utf8');
  const regex = /<(?:script|link|img|source|iframe)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(regex)) {
    const value = match[1];
    if (/^(?:https?:|data:|chrome-extension:|mailto:|#)/i.test(value)) continue;
    const clean = value.split(/[?#]/)[0];
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(relative), clean));
    safePath(resolved);
    requireCondition(paths.includes(resolved), `Missing HTML asset ${resolved}, referenced by ${relative}`);
  }
}

/** Read-only validation. _metadata is the sole permitted unhashed input subtree. */
export async function validateExtension(dist, { expectedSource = null } = {}) {
  const files = await walk(dist);
  const excludedRuntimeFiles = files.filter(file => file.startsWith('_metadata/'));
  const packaged = files.filter(file => !file.startsWith('_metadata/'));
  for (const file of packaged) requireCondition(!forbiddenPath(file, { submission: true }), `Forbidden submission input: ${file}`);
  for (const file of REQUIRED_PACKAGE_FILES) requireCondition(packaged.includes(file), `Missing required packaged license/metadata/asset: ${file}. Add it in the build BEFORE checksums; this script will not repair dist.`);
  const manifestBytes = await readFile(path.join(dist, 'manifest.json'));
  const manifest = JSON.parse(manifestBytes);
  requireCondition(manifest.manifest_version === 3 && manifest.version === VERSION, `Expected root MV3 manifest ${VERSION}.`);
  requireCondition(manifest.default_locale === 'en', 'Expected default locale en.');
  const checksumsBytes = await readFile(path.join(dist, 'checksums.json'));
  const checksums = JSON.parse(checksumsBytes);
  requireCondition(checksums && typeof checksums === 'object' && !Array.isArray(checksums), 'checksums.json must be a path→SHA-256 object.');
  const expected = packaged.filter(file => file !== 'checksums.json').sort(compare);
  const recorded = Object.keys(checksums).sort(compare);
  for (const file of recorded) { safePath(file); requireCondition(/^[a-f0-9]{64}$/.test(checksums[file]), `Invalid checksum for ${file}`); }
  assert.deepEqual(recorded, expected, 'checksums.json must cover every packaged file exactly once, excluding itself and browser-owned _metadata.');
  const entries = [];
  for (const file of packaged.sort(compare)) {
    const entry = await fileEntry(dist, file);
    if (file !== 'checksums.json') requireCondition(entry.sha256 === checksums[file], `Qualified dist changed: checksum mismatch for ${file}`);
    entries.push(entry);
  }
  manifestAssets(manifest, packaged);
  for (const file of packaged.filter(file => file.endsWith('.html'))) await htmlAssets(dist, file, packaged);
  const actualLocales = [...new Set(packaged.filter(file => /^_locales\/[^/]+\/messages\.json$/.test(file)).map(file => file.split('/')[1]))].sort(compare);
  assert.deepEqual(actualLocales, LOCALES, 'Submission must include exactly the eight approved Chrome locales.');
  for (const locale of LOCALES) {
    const messages = JSON.parse(await readFile(path.join(dist, `_locales/${locale}/messages.json`), 'utf8'));
    for (const token of JSON.stringify(manifest).matchAll(/__MSG_([A-Za-z0-9_]+)__/g)) requireCondition(typeof messages[token[1]]?.message === 'string' && messages[token[1]].message.trim(), `Missing manifest translation ${token[1]} in ${locale}`);
    requireCondition(packaged.includes(`locales/${locale}.json`), `Missing runtime locale ${locale}`);
    const localeCopy = JSON.parse(await readFile(path.join(dist, `locales/${locale}.json`), 'utf8'));
    requireCondition(localeCopy && typeof localeCopy === 'object' && Object.keys(localeCopy).length > 0, `Empty runtime locale ${locale}`);
  }
  const sources = JSON.parse(await readFile(path.join(dist, 'engine/filter-sources.json'), 'utf8'));
  const report = JSON.parse(await readFile(path.join(dist, 'engine/build-report.json'), 'utf8'));
  requireCondition(typeof sources.revision === 'string' && sources.revision.length > 0 && Array.isArray(sources.lists) && sources.lists.length > 0, 'Missing filter source revision/list metadata.');
  requireCondition(report.gate === false && report.revision === sources.revision, 'Engine report is a gate build or disagrees with pinned filter revision.');
  for (const list of sources.lists) requireCondition(list.filterId !== 9000 && /^[a-f0-9]{64}$/.test(list.sha256), 'Invalid/gate filter source metadata.');
  const sbom = JSON.parse(await readFile(path.join(dist, 'SBOM.json'), 'utf8'));
  requireCondition(sbom && typeof sbom === 'object' && !Array.isArray(sbom) && Object.keys(sbom).length > 0, 'Empty SBOM.');
  for (const file of REQUIRED_PACKAGE_FILES.filter(file => !['manifest.json', 'checksums.json'].includes(file))) {
    const bytes = await readFile(path.join(dist, file));
    requireCondition(bytes.length > 30, `Empty/placeholder release notice: ${file}`);
    assertNoHostPaths(bytes, file);
  }
  if (expectedSource) {
    for (const [file, source] of Object.entries(expectedSource)) {
      const actual = await readFile(path.join(dist, file));
      requireCondition(sha256(actual) === sha256(await readFile(source)), `Packaged ${file} differs from audited source. Rebuild and requalify before packaging.`);
    }
  }
  return { entries, excludedRuntimeFiles, manifestSha256: sha256(manifestBytes), checksumsManifestSha256: sha256(checksumsBytes), filterRevision: sources.revision };
}

async function collectSource(root, { website = false } = {}) {
  const selected = new Set(website ? WEBSITE_FILES : SOURCE_FILES);
  for (const directory of website ? WEBSITE_TREES : SOURCE_TREES) for (const file of await walk(path.join(root, directory), directory)) selected.add(file);
  if (!website) {
    // Only actual engine source/tests, never generated runtime or acceptance outputs.
    for (const item of await readdir(path.join(root, 'B2/engine'))) if (/\.(?:ts|tsx)$/.test(item)) selected.add(`B2/engine/${item}`);
    const readme = await readFile(path.join(root, 'B2/README.md'), 'utf8');
    requireCondition(/BLOKU\s+2\.0/i.test(readme) && readme.includes('build:v2'), 'Source archive requires the audited 2.0 build README, not the legacy README.');
  }
  const entries = [];
  for (const file of [...selected].sort(compare)) {
    safePath(file);
    requireCondition(!forbiddenPath(file) && !file.split('/').includes('_metadata'), `Forbidden source input: ${file}`);
    const entry = await fileEntry(root, file, EXECUTABLE_SOURCE_FILES.has(file) ? 0o755 : 0o644);
    if (/\.(?:[cm]?js|json|ts|tsx|md|html|css|txt)$/.test(file)) assertNoHostPaths(await readFile(entry.absolute), file);
    entries.push(entry);
  }
  return entries;
}

const PYTHON_ZIP = String.raw`
import hashlib, json, os, stat, sys, zipfile
request=json.load(sys.stdin)
entries=request['entries']
names=[entry['path'] for entry in entries]
if names != sorted(names) or len(names) != len(set(names)):
    raise RuntimeError('Archive entries must be unique and sorted')
with zipfile.ZipFile(request['output'], 'w', compression=zipfile.ZIP_STORED, allowZip64=True) as archive:
    for entry in entries:
        name=entry['path']
        if name.startswith('/') or '\\' in name or any(part in ('', '.', '..') for part in name.split('/')):
            raise RuntimeError('Unsafe archive path')
        if os.path.islink(entry['absolute']) or not stat.S_ISREG(os.lstat(entry['absolute']).st_mode):
            raise RuntimeError('Input changed to a nonregular file: '+name)
        with open(entry['absolute'], 'rb') as source: data=source.read()
        if hashlib.sha256(data).hexdigest()!=entry['sha256']:
            raise RuntimeError('Input changed during packaging: '+name)
        info=zipfile.ZipInfo(name, tuple(request['epoch']))
        info.create_system=3
        info.external_attr=(stat.S_IFREG | entry['mode']) << 16
        info.compress_type=zipfile.ZIP_STORED
        info.extra=b''
        info.comment=b''
        archive.writestr(info,data)
with zipfile.ZipFile(request['output']) as archive:
    if archive.namelist()!=names: raise RuntimeError('Archive entry mismatch')
    for entry, info in zip(entries, archive.infolist()):
        if info.date_time!=tuple(request['epoch']) or (info.external_attr >> 16)&0o777 != entry['mode']:
            raise RuntimeError('Archive timestamp or permission mismatch')
        if hashlib.sha256(archive.read(info.filename)).hexdigest()!=entry['sha256']:
            raise RuntimeError('Archive byte mismatch: '+info.filename)
`;

export async function writeZip(output, entries) {
  const result = spawnSync('python3', ['-c', PYTHON_ZIP], {
    input: JSON.stringify({ output, entries, epoch: EPOCH }), encoding: 'utf8', maxBuffer: 1024 * 1024,
  });
  requireCondition(!result.error && result.status === 0, `Deterministic ZIP failed: ${result.error?.message || result.stderr || result.status}`);
  const bytes = await readFile(output);
  return { file: path.basename(output), sha256: sha256(bytes), bytes: bytes.length, entries: entries.length };
}

async function selfTest() {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'bloku-release-self-test-'));
  let checks = 0;
  const check = (fn) => { fn(); checks++; };
  try {
    for (const unsafe of ['../escape', '/absolute', 'C:/host', 'a\\b', 'a//b', './file']) check(() => assert.throws(() => safePath(unsafe)));
    check(() => assert.equal(safePath('engine/filters/filter_2.txt'), 'engine/filters/filter_2.txt'));
    check(() => assert.ok(forbiddenPath('backend/routes.js', { submission: true })));
    check(() => assert.ok(forbiddenPath('engine/rulesets/ruleset_9000/ruleset_9000.json', { submission: true })));
    check(() => assert.ok(forbiddenPath('runtime-probe.js', { submission: true })));
    check(() => assert.ok(forbiddenPath('.env.production')));
    check(() => assert.throws(() => assertNoHostPaths(Buffer.from('Package: `/Users/example/project/dist`'), 'docs/report.md'), /Host-specific path/));
    check(() => assert.throws(() => assertNoHostPaths(Buffer.from('Package: `/home/example/project/dist`'), 'docs/report.md'), /Host-specific path/));
    check(() => assert.ok(!forbiddenPath('B2/engine/gate-fixture.txt')));
    check(() => assert.deepEqual(glob('locales/*.json', ['locales/en.json', 'background.js']), ['locales/en.json']));
    check(() => assert.throws(() => manifestAssets({ icons: { 16: 'missing.png' } }, ['manifest.json'])));
    await writeFile(path.join(temporary, 'a.txt'), 'Small deterministic release fixture.\n');
    const entries = [await fileEntry(temporary, 'a.txt')];
    const first = await writeZip(path.join(temporary, 'first.zip'), entries);
    const second = await writeZip(path.join(temporary, 'second.zip'), entries);
    check(() => assert.equal(first.sha256, second.sha256));
    await writeFile(path.join(temporary, 'a.txt'), 'Changed after hashing.\n');
    await assert.rejects(writeZip(path.join(temporary, 'race.zip'), entries), /Input changed during packaging/); checks++;
    const fixture = path.join(temporary, 'dist-fixture');
    const fixtureManifest = { manifest_version: 3, version: VERSION, default_locale: 'en', name: '__MSG_extensionName__', description: '__MSG_extensionDescription__', background: { service_worker: 'background.js' }, action: { default_popup: 'popup.html' }, icons: { 16: 'icons/icon.png' }, declarative_net_request: { rule_resources: [{ id: 'ruleset_2', path: 'engine/rulesets/ruleset_2.json', enabled: true }] }, web_accessible_resources: [{ resources: ['engine/war/*'], matches: ['https://*/*'] }] };
    const fixtureFiles = {
      'manifest.json': JSON.stringify(fixtureManifest), 'background.js': 'export const fixtureOnly = true;\n',
      'popup.html': '<!doctype html><script src="background.js"></script>', 'icons/icon.png': 'fixture bytes',
      'engine/rulesets/ruleset_2.json': '[]', 'engine/war/noop.js': '// no operation',
      'LICENSE': 'A fixture license for packaging tests only.\n'.repeat(3),
      'NOTICE.md': 'A fixture notice for packaging tests only.\n'.repeat(3),
      'PRIVACY_POLICY.md': 'A fixture policy for packaging tests only.\n'.repeat(3),
      'third-party/LICENSE.Autoconsent': 'A fixture Autoconsent license; not a release license.\n',
      'engine/LICENSE.AdGuard': 'A fixture SDK license; not a release license.\n',
      'engine/filter-sources.json': JSON.stringify({ revision: 'fixture-revision', lists: [{ filterId: 2, sha256: 'a'.repeat(64) }] }),
      'engine/build-report.json': JSON.stringify({ revision: 'fixture-revision', gate: false }),
      'SBOM.json': JSON.stringify({ name: 'Tiny packaging fixture, never a candidate', components: [] }),
    };
    for (const locale of LOCALES) {
      fixtureFiles[`_locales/${locale}/messages.json`] = JSON.stringify({ extensionName: { message: `Fixture ${locale}` }, extensionDescription: { message: 'Synthetic validation fixture' } });
      fixtureFiles[`locales/${locale}.json`] = JSON.stringify({ name: `Fixture ${locale}` });
    }
    const put = async (relative, bytes) => { await mkdir(path.dirname(path.join(fixture, relative)), { recursive: true }); await writeFile(path.join(fixture, relative), bytes); };
    for (const [relative, bytes] of Object.entries(fixtureFiles)) await put(relative, bytes);
    const hashFixture = async () => {
      const checksums = {};
      for (const relative of await walk(fixture)) if (relative !== 'checksums.json' && !relative.startsWith('_metadata/')) checksums[relative] = sha256(await readFile(path.join(fixture, relative)));
      await put('checksums.json', JSON.stringify(checksums));
    };
    await hashFixture();
    await put('_metadata/computed_hashes.json', '{}');
    const validated = await validateExtension(fixture);
    check(() => assert.deepEqual(validated.excludedRuntimeFiles, ['_metadata/computed_hashes.json']));
    check(() => assert.ok(validated.entries.every(entry => !entry.path.startsWith('_metadata/'))));
    await put('unlisted.js', '// unexpected');
    await assert.rejects(validateExtension(fixture), /checksums.json must cover/); checks++;
    await rm(path.join(fixture, 'unlisted.js'));
    await put('background.js', '// tampered after qualification');
    await assert.rejects(validateExtension(fixture), /checksum mismatch/); checks++;
    await put('background.js', fixtureFiles['background.js']);
    await rm(path.join(fixture, 'NOTICE.md'));
    await assert.rejects(validateExtension(fixture), /Missing required packaged/); checks++;
    await put('NOTICE.md', fixtureFiles['NOTICE.md']);
    await put('manifest.json', JSON.stringify({ ...fixtureManifest, declarative_net_request: { rule_resources: [{ id: 'ruleset_9000', path: 'engine/rulesets/ruleset_2.json' }] } }));
    await hashFixture();
    await assert.rejects(validateExtension(fixture), /ruleset 9000/); checks++;
    await put('manifest.json', fixtureFiles['manifest.json']);
    await put('engine/build-report.json', JSON.stringify({ revision: 'fixture-revision', gate: true }));
    await hashFixture();
    await assert.rejects(validateExtension(fixture), /gate build/); checks++;
    await put('engine/build-report.json', fixtureFiles['engine/build-report.json']);
    await rm(path.join(fixture, 'locales/ja.json'));
    await hashFixture();
    await assert.rejects(validateExtension(fixture), /Missing runtime locale ja/); checks++;
    console.log(`Release artifact self-test: ${checks}/${checks} passed; tiny fixtures only, no dist/build/browser touched.`);
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

async function main(args) {
  let output = path.join(ROOT, 'artifacts/release');
  const outputIndex = args.indexOf('--output-dir');
  if (outputIndex >= 0) {
    requireCondition(!args.includes('--self-test') && args.lastIndexOf('--output-dir') === outputIndex && typeof args[outputIndex + 1] === 'string' && !args[outputIndex + 1].startsWith('--'), 'Provide one output directory with release options.');
    output = path.resolve(ROOT, args[outputIndex + 1]);
    const relativeOutput = path.relative(path.join(ROOT, 'artifacts'), output);
    requireCondition(relativeOutput && relativeOutput !== '..' && !relativeOutput.startsWith(`..${path.sep}`) && !path.isAbsolute(relativeOutput), 'Output must be a directory beneath this workspace artifacts folder.');
    args = args.filter((_, index) => index !== outputIndex && index !== outputIndex + 1);
  }
  const known = new Set(['--help', '--self-test', '--check-only', '--extension-only', '--include-website-source']);
  for (const flag of args) requireCondition(known.has(flag), `Unknown option: ${flag}`);
  if (args.includes('--help')) {
    console.log('Usage: node B2/scripts/v2-release-artifacts.mjs [--check-only] [--extension-only] [--include-website-source] [--output-dir artifacts/release-rc2]\n       node B2/scripts/v2-release-artifacts.mjs --self-test\nReads the existing B2/dist without building or repairing it. Defaults to artifacts/release. Packaging is not release qualification.'); return;
  }
  if (args.includes('--self-test')) { requireCondition(args.length === 1, '--self-test cannot be combined with release options.'); await selfTest(); return; }
  requireCondition(!(args.includes('--extension-only') && args.includes('--include-website-source')), 'Website source requires the normal source-archive mode.');
  const packageJson = JSON.parse(await readFile(path.join(B2, 'package.json'), 'utf8'));
  const sourceManifest = JSON.parse(await readFile(path.join(B2, 'v2-manifest.json'), 'utf8'));
  requireCondition(packageJson.version === VERSION && sourceManifest.version === VERSION, 'Root package and source manifest must both be version 2.0.0.');
  const extension = await validateExtension(path.join(B2, 'dist'), { expectedSource: {
    'LICENSE': path.join(ROOT, 'LICENSE'), 'NOTICE.md': path.join(B2, 'NOTICE.v2.md'),
    'PRIVACY_POLICY.md': path.join(B2, 'PRIVACY_POLICY.v2.md'), 'engine/filter-sources.json': path.join(B2, 'engine/vendor/sources.json'),
  } });
  const jobs = [{ name: `bloku-${VERSION}-chrome.zip`, kind: 'chrome-candidate', entries: extension.entries }];
  if (!args.includes('--extension-only')) jobs.push({ name: `bloku-${VERSION}-source.zip`, kind: 'extension-source', entries: await collectSource(ROOT) });
  if (args.includes('--include-website-source')) jobs.push({ name: `bloku-${VERSION}-website-source.zip`, kind: 'website-source', entries: await collectSource(ROOT, { website: true }) });
  if (args.includes('--check-only')) {
    console.log(JSON.stringify({ status: 'INPUTS_VALID_NOT_RELEASE_QUALIFIED', version: VERSION, archives: jobs.map(job => ({ file: job.name, entries: job.entries.length })), excludedRuntimeFiles: extension.excludedRuntimeFiles, manifestSha256: extension.manifestSha256, checksumsManifestSha256: extension.checksumsManifestSha256 }, null, 2)); return;
  }
  await mkdir(output, { recursive: true });
  const temporary = await mkdtemp(path.join(output, '.v2-release-'));
  try {
    const archives = [];
    for (const job of jobs) archives.push({ ...await writeZip(path.join(temporary, job.name), job.entries), kind: job.kind });
    const release = {
      status: 'CANDIDATE_NOT_RELEASE_QUALIFIED', version: VERSION, zipPolicy: { compression: 'stored', timestamp: '1980-01-01T00:00:00', regularFileMode: '0644', executableSourceFiles: [...EXECUTABLE_SOURCE_FILES] },
      extension: { manifestSha256: extension.manifestSha256, checksumsManifestSha256: extension.checksumsManifestSha256, filterRevision: extension.filterRevision, excludedRuntimeFiles: extension.excludedRuntimeFiles },
      archives, inputs: Object.fromEntries(jobs.map(job => [job.name, Object.fromEntries(job.entries.map(entry => [entry.path, entry.sha256]))])),
    };
    const manifestBytes = Buffer.from(`${JSON.stringify(release, null, 2)}\n`);
    await writeFile(path.join(temporary, 'release-manifest.json'), manifestBytes);
    const sums = [...archives.map(archive => `${archive.sha256}  ${archive.file}`), `${sha256(manifestBytes)}  release-manifest.json`].sort(compare).join('\n') + '\n';
    await writeFile(path.join(temporary, 'SHA256SUMS'), sums);
    for (const file of [...jobs.map(job => job.name), 'release-manifest.json', 'SHA256SUMS']) await rename(path.join(temporary, file), path.join(output, file));
    console.log(JSON.stringify({ status: release.status, output: path.relative(ROOT, output), archives, excludedRuntimeFiles: extension.excludedRuntimeFiles, qualification: 'Run the coordinator-approved exact-package gates before publication.' }, null, 2));
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv.slice(2)).catch(error => { console.error(`Release artifacts refused: ${error.message}`); process.exitCode = 1; });
}
