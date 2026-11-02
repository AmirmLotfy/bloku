import { createBlokuEngine } from './adapter';
import type { EngineInput } from './types';

const engine = createBlokuEngine();
const input: EngineInput = { adsEnabled: true, siteExceptions: [], focusDomains: [], userRules: '', enabledLists: ['gate'] };
Object.assign(globalThis, { blokuGate: engine, blokuGateReady: engine.initialize(input) });
