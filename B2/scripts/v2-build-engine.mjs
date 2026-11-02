import { mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Filter, RulesetWithSourceMap, parseCompactRuleset } from '@adguard/dnr-converter';
import { convertFilters } from '@adguard/dnr-converter/cli';
import { FilterList } from '@adguard/tsurlfilter';
import { RuleParser } from '@adguard/agtree/parser';
import { CosmeticRuleBodyGenerator } from '@adguard/agtree/generator';
import { copyWar } from '@adguard/tswebextension/cli';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gate = process.argv.includes('--gate');
const output = path.join(root, gate ? 'engine/gate-generated' : 'engine/generated');
const runtime = path.join(output, 'runtime');
const lock = JSON.parse(await readFile(path.join(root, 'engine/vendor/sources.json'), 'utf8'));
const sources = [...lock.lists];
if (gate) sources.push({ id: 'gate', filterId: 9000, name: 'Local acceptance fixtures', sha256: null });
await rm(output, { recursive: true, force: true });
await mkdir(path.join(runtime, 'engine/filters'), { recursive: true });
await mkdir(path.join(runtime, 'engine/rulesets'), { recursive: true });
await copyWar(path.join(runtime, 'engine/war'));

const filterInputs = [];
const catalog = [];
const scriptBodies = new Set();
const exclusions = [];
for (const source of sources) {
  const bytes = await readFile(path.join(root, source.filterId === 9000 ? 'engine/gate-fixture.txt' : `engine/vendor/filter_${source.filterId}.txt`));
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (source.sha256 && source.sha256 !== hash) throw new Error(`${source.id}: source hash mismatch; run explicit update command.`);
  const rawText = bytes.toString('utf8');
  const version = rawText.match(/^!\s*Version:\s*(.+)$/m)?.[1].trim();
  const updatedAt = rawText.match(/^!\s*TimeUpdated:\s*(.+)$/m)?.[1].trim();
  if (updatedAt && !Number.isFinite(Date.parse(updatedAt))) throw new Error(`${source.id}: invalid upstream update date.`);
  const accepted = [];
  for (const [index, line] of rawText.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const rule = RuleParser.parse(line);
    if (rule.category === 'Network' && rule.type === 'NetworkRule' && rule.modifiers?.children.some(modifier => modifier.name.value === 'cookie')) {
      exclusions.push({ list: source.id, line: index + 1, reason: 'cookie capability excluded', rule: line });
      continue;
    }
    accepted.push(line);
  }
  const list = new FilterList(accepted.join('\n'), source.filterId);
  const content = list.getContent();
  if (list.getConversionErrors().length) throw new Error(`${source.id}: source conversion failed: ${JSON.stringify(list.getConversionErrors().slice(0, 3))}`);
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    const rule = RuleParser.parse(line);
    if (rule.category === 'Cosmetic' && rule.type === 'JsInjectionRule') scriptBodies.add(CosmeticRuleBodyGenerator.generate(rule));
  }
  await writeFile(path.join(runtime, `engine/filters/filter_${source.filterId}.txt`), content);
  filterInputs.push(new Filter(source.filterId, content));
  catalog.push({ id: source.id, filterId: source.filterId, name: source.name, version, updatedAt, ruleCount: 0, focusOverrideRules: [] });
}

// The official Node CLI API initializes its RE2/WASM validator. The browser API
// alone must not be used in Node: it would incorrectly reject every regex.
await writeFile(path.join(runtime, 'engine/filters/filters.json'), JSON.stringify(catalog.map(({ filterId, name }) => ({ filterId, name }))));
const converterLog = [];
const originalConsole = { log: console.log, info: console.info, warn: console.warn, error: console.error };
for (const key of Object.keys(originalConsole)) console[key] = (...args) => converterLog.push(args.map(String).join(' '));
try {
  await convertFilters(path.join(runtime, 'engine/filters'), '/engine/war/redirects', path.join(runtime, 'engine/rulesets'), { debug: true, prettifyJson: false });
} finally { Object.assign(console, originalConsole); }
await writeFile(path.join(output, 'converter-diagnostics.log'), `${converterLog.join('\n')}\n`);
if (converterLog.some(line => line.startsWith('Some converted rules were discarded'))) throw new Error('Converter quota truncation is forbidden.');
const ruleResources = [];
const diagnostics = [];
const knownUnsupported = [
  /^Regex is unsupported in rule:/,
  /^Network rule with explicitly enabled \$popup modifier is not supported(?::|$)/,
  /^Network allowlist rule with \$(redirect|csp) modifier is not supported(?::|$)/,
  /^Network rule with \$removeparam modifier with negation or regexp is not supported(?::|$)/,
  /^Declarative network rules with \$header modifier cannot contain regex values(?::|$)/,
  /^Unsupported option "\$(genericblock|stealth)"(?::|$)/,
  /^Network rule with "\$(jsinject|urlblock)" modifier is not supported(?::|$)/,
  /^"\$permissions is not compatible with \$document" in the rule:/,
  /^Conversion initiatorDomains is empty, but original rule's domains not:.*domain=\//,
];
for (const entry of catalog) {
  const id = `ruleset_${entry.filterId}`;
  const parsed = JSON.parse(await readFile(path.join(runtime, `engine/rulesets/${id}/${id}.json`), 'utf8'));
  const compact = parseCompactRuleset(id, parsed);
  const ruleset = RulesetWithSourceMap.fromCompact(id, compact, filterInputs.filter(filter => filter.getId() === entry.filterId));
  const rules = await ruleset.getDeclarativeRules();
  entry.ruleCount = parsed.length;
  // Only installed important overrides need DNR cancellation. Unsupported
  // upstream exceptions must never be promoted into failing local user rules.
  const important = new Set();
  for (const rule of rules.filter(rule => ['allow', 'allowAllRequests', 'redirect', 'upgradeScheme'].includes(rule.action.type) && rule.priority >= 1_000_000)) {
    for (const source of await ruleset.getRulesById(rule.id)) important.add(source.sourceRule);
  }
  entry.focusOverrideRules = [...important];
  const begin = converterLog.findIndex(line => line === `Filter #${id} info`);
  const section = converterLog.slice(begin + 1);
  const countIndex = section.findIndex(line => /^Errors: \d+$/.test(line));
  const errorCount = Number(section[countIndex]?.split(': ')[1]);
  if (!Number.isInteger(errorCount)) throw new Error(`Missing converter diagnostics for ${id}`);
  const errorHeader = section.findIndex(line => line === 'Converted with following errors: ');
  const errors = errorCount ? section.slice(errorHeader + 1).filter(line => !/^=+$/.test(line)).slice(0, errorCount) : [];
  const unexpected = errors.filter(error => !knownUnsupported.some(pattern => pattern.test(error)));
  if (unexpected.length) throw new Error(`${id}: unexpected conversion errors: ${unexpected.slice(0, 3).join('\n')}`);
  diagnostics.push({ id, convertedRules: rules.length, supportedRegexRules: rules.filter(rule => rule.condition.regexFilter).length, excludedUnsupportedNetworkRules: errors.length, errors, limitations: [] });
  ruleResources.push({ id, enabled: false, path: `engine/rulesets/${id}/${id}.json` });
}

// Raw scripts are converted into ordinary packaged functions at build time only.
// This follows AdGuard's local-script strategy; no eval/new Function is used at runtime.
const helpers = new Map();
for (const body of scriptBodies) {
  const match = body.match(/var\s+(AG_[a-zA-Z0-9_]+)\s*=\s*function/);
  if (match) helpers.set(match[1], body);
}
const functions = [];
for (const body of scriptBodies) {
  const dependencies = [...new Set(body.match(/AG_[a-zA-Z0-9_]+/g) ?? [])].map(name => helpers.get(name)).filter(Boolean);
  const marker = `bloku_${createHash('sha256').update(body).digest('hex')}`;
  functions.push(`${JSON.stringify(body)}: function(){ const key=${JSON.stringify(marker)}; if(Object.prototype.hasOwnProperty.call(Window.prototype.toString,key))return; try { ${dependencies.join('\n')}\n${body}\nObject.defineProperty(Window.prototype.toString,key,{value:true}); } catch {} }`);
}
await writeFile(path.join(output, 'local-script-rules.js'), `// Generated from pinned upstream sources. GPL-3.0-only.\nexport const localScriptRules = {\n${functions.join(',\n')}\n};\n`);
await writeFile(path.join(output, 'local-script-rules.d.ts'), 'export const localScriptRules: Record<string, (...args: unknown[]) => void>;\n');
await build({ stdin: { contents: await readFile(path.join(output, 'local-script-rules.js'), 'utf8'), resolveDir: root, loader: 'js' }, write: false, logLevel: 'silent' });
for (const [entry, name] of [['@adguard/tswebextension/mv3/content-script', 'content-script'], ['@adguard/tswebextension/assistant-inject', 'assistant'], ['@adguard/tswebextension/mv3/gpc', 'gpc'], ['@adguard/tswebextension/mv3/hide-document-referrer', 'hide-document-referrer']]) {
  await build({ absWorkingDir: root, entryPoints: [entry], outfile: path.join(runtime, `engine/${name}.js`), bundle: true, format: 'iife', target: 'chrome145', minify: false, legalComments: 'external', logLevel: 'silent' });
}
await writeFile(path.join(output, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
await writeFile(path.join(output, 'build-info.json'), `${JSON.stringify({ sdk: '6.0.1', converter: '2.0.0', revision: lock.revision }, null, 2)}\n`);
await writeFile(path.join(output, 'rule-resources.json'), `${JSON.stringify(ruleResources, null, 2)}\n`);
await writeFile(path.join(output, 'build-report.json'), `${JSON.stringify({ sdk: '6.0.1', converter: '2.0.0', revision: lock.revision, gate, exclusions, diagnostics, bundledRawScripts: scriptBodies.size }, null, 2)}\n`);
await cp(path.join(root, 'node_modules/@adguard/tswebextension/LICENSE'), path.join(runtime, 'engine/LICENSE.AdGuard'));
console.log(JSON.stringify({ output, lists: catalog.map(({ id, ruleCount, focusOverrideRules }) => ({ id, ruleCount, focusOverrides: focusOverrideRules.length })), bundledRawScripts: scriptBodies.size, conversionErrors: diagnostics.reduce((n, item) => n + item.errors.length, 0), exclusions: exclusions.length }));
