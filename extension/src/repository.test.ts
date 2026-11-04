import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepository } from './repository';
import { V2_STORAGE_KEY } from './migration';
function memory() {const data:Record<string,unknown>={};return {data,async get(){return structuredClone(data);},async set(items:Record<string,unknown>){Object.assign(data,structuredClone(items));},async remove(keys:string[]){keys.forEach(k=>delete data[k]);}};}
test('concurrent updates do not lose changes', async () => {
  const store=memory();const repo=createRepository(store);
  await Promise.all([repo.update(s=>{s.preferences.adsEnabled=false;return s;}), repo.update(s=>{s.preferences.theme='dark';return s;})]);
  const state=await repo.get();assert.equal(state.preferences.adsEnabled,false);assert.equal(state.preferences.theme,'dark');
});
test('failed changes leave persisted settings and queue usable',async()=>{
  const store=memory();const repo=createRepository(store);const before=await repo.get();
  await assert.rejects(repo.update(s=>{s.preferences.theme='bad' as never;return s;}));
  assert.deepEqual(store.data[V2_STORAGE_KEY],before);
  const state=await repo.update(s=>{s.preferences.theme='light';return s;});assert.equal(state.preferences.theme,'light');
});
test('callers cannot mutate the cached state by reference',async()=>{
  const repo=createRepository(memory());const state=await repo.get();state.preferences.adsEnabled=false;
  assert.equal((await repo.get()).preferences.adsEnabled,true);
});
