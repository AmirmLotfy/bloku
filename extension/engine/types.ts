export interface EngineInput {
  adsEnabled: boolean;
  siteExceptions: string[];
  focusDomains: string[];
  userRules: string;
  enabledLists: string[];
}

export interface EngineIssue {
  code: string;
  message: string;
  line?: number;
}

export interface EngineStatus {
  ok: boolean;
  state: EngineInput | null;
  errors: EngineIssue[];
  restored: boolean;
  revision: number;
}

export interface EngineStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export interface EngineOptions {
  storage?: EngineStorage;
  documentBlockingPageUrl?: string;
  onPickerRule?: (rule: string) => void | Promise<void>;
}

export interface BlokuEngine {
  initialize(input: EngineInput): Promise<EngineStatus>;
  apply(input: EngineInput): Promise<EngineStatus>;
  getStatus(): EngineStatus;
  openPicker(tabId: number): Promise<void>;
}

export interface PackagedList {
  id: string;
  filterId: number;
  name: string;
  version?: string;
  updatedAt?: string;
  ruleCount: number;
  focusOverrideRules: string[];
}
