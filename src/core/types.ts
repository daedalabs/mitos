// Headless core types for Mitos — zero Obsidian imports allowed

export type AngleType = 'pain_point' | 'contrarian' | 'teardown';

export type SeriesArchetype = 
  | '3_act_engineering_problem'
  | 'deep_dive_breakdown'
  | 'versus_comparison';

export type AntiSlopStrictness = 'lenient' | 'standard' | 'ruthless';

export interface SlopLintResult {
  score: number; // 0 - 100
  passed: boolean;
  warnings: string[];
  bannedWordsFound: string[];
  hookWordCount: number;
  hasConcreteProof: boolean;
  strictness: AntiSlopStrictness;
}

export interface Angle {
  id: string;
  angleType: AngleType;
  title: string;
  hook: string;
  coreTension: string;
  visualProofAnchor: string;
  openLoop: string;
  lint: SlopLintResult;
}

export interface Episode {
  n: number;
  title: string;
  hook: string;
  coreTension: string;
  visualProofAnchor: string;
  cliffhanger: string;
  payoff_from_prev: string;
  lint?: SlopLintResult;
}

export interface SeriesPlan {
  series_title: string;
  premise: string;
  archetype: SeriesArchetype;
  episodes: Episode[];
  cadenceDays?: number;
}

export type MitosErrorKind =
  | 'auth'
  | 'network'
  | 'rate_limit'
  | 'parse'
  | 'invalid_model'
  | 'vault'
  | 'canceled';

export class MitosError extends Error {
  kind: MitosErrorKind;
  retriable: boolean;
  status?: number;

  constructor(message: string, kind: MitosErrorKind, retriable: boolean = false, status?: number) {
    super(message);
    this.name = 'MitosError';
    this.kind = kind;
    this.retriable = retriable;
    this.status = status;
  }
}

export interface HttpRequestOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface HttpResponse {
  status: number;
  headers?: Record<string, string>;
  text?: string;
  json?: any;
}

export type HttpClient = (options: HttpRequestOptions) => Promise<HttpResponse>;

export interface VaultFileLike {
  path: string;
  basename: string;
}

export interface VaultLike {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  createFolder(folder: string): Promise<void>;
  delete(path: string): Promise<void>;
  getMarkdownFiles(): Promise<VaultFileLike[]>;
  process?(path: string, fn: (data: string) => string): Promise<string>;
}

export interface ContentEntry {
  path: string;
  title: string;
  hook?: string;
  tags: string[];
  publishDate?: string;
  series?: string;
  similarityScore?: number;
}

export interface MitosSettings {
  aiProvider: 'gemini' | 'openai' | 'ollama' | 'mcp';
  geminiApiKey: string;
  openaiApiKey: string;
  ollamaEndpoint: string;
  ollamaModel: string;
  mcpEndpoint: string;
  mcpToolName: string;
  contentFolder: string;
  antiSlopStrictness: AntiSlopStrictness;
}
