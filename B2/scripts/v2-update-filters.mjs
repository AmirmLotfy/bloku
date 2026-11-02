import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Explicit maintenance command only. The extension and regular build never download lists.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const revision = process.argv[2];
if (!/^[0-9a-f]{40}$/.test(revision ?? '')) throw new Error('Pass an exact FiltersRegistry Git commit.');
const lists = [
  { id: 'base', filterId: 2, name: 'AdGuard Base', source: 'platforms/extension/chromium-mv3/filters/2.txt' },
  { id: 'privacy', filterId: 3, name: 'AdGuard Tracking Protection', source: 'platforms/extension/chromium-mv3/filters/3.txt' },
  { id: 'base-optimized', filterId: 20002, name: 'AdGuard Base — optimized, lower capacity', source: 'platforms/extension/chromium-mv3/filters/2_optimized.txt' },
  { id: 'region-ar', filterId: 112, name: 'Arabic — Liste AR', source: 'platforms/extension/chromium-mv3/filters/112.txt' },
  { id: 'region-de', filterId: 6, name: 'AdGuard German', source: 'platforms/extension/chromium-mv3/filters/6.txt' },
  { id: 'region-ja', filterId: 7, name: 'AdGuard Japanese', source: 'platforms/extension/chromium-mv3/filters/7.txt' },
  { id: 'region-es-pt', filterId: 9, name: 'AdGuard Spanish/Portuguese', source: 'platforms/extension/chromium-mv3/filters/9.txt' },
  { id: 'region-fr', filterId: 16, name: 'AdGuard French', source: 'platforms/extension/chromium-mv3/filters/16.txt' },
  { id: 'region-hi', filterId: 253, name: 'Hindi — IndianList', source: 'platforms/extension/chromium-mv3/filters/253.txt' },
  { id: 'annoyances', filterId: 21, name: 'AdGuard Other Annoyances', source: 'platforms/extension/chromium-mv3/filters/21.txt' },
];
await mkdir(path.join(root, 'engine/vendor'), { recursive: true });
for (const list of lists) {
  list.url = `https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/${revision}/${list.source}`;
  const response = await fetch(list.url);
  if (!response.ok) throw new Error(`${list.id}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 10_000) throw new Error(`${list.id}: unexpected empty/truncated source`);
  list.sha256 = createHash('sha256').update(bytes).digest('hex');
  await writeFile(path.join(root, `engine/vendor/filter_${list.filterId}.txt`), bytes);
}
await writeFile(path.join(root, 'engine/vendor/sources.json'), `${JSON.stringify({ revision, lists }, null, 2)}\n`);
console.log(`Pinned ${lists.length} real upstream lists at ${revision}.`);
