import { describe, it, expect } from 'vitest';
import { lintScriptForSlop, BANNED_AI_WORDS } from '../src/core/anti_slop';

describe('anti_slop linter', () => {
  it('passes a clean, punchy technical script with concrete proof', () => {
    const text = 'Your RAG demo dies at 10k documents. Vector latency jumps from 20ms to 900ms in our benchmark.';
    const result = lintScriptForSlop(text, 'standard');

    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.bannedWordsFound).toHaveLength(0);
    expect(result.hasConcreteProof).toBe(true);
  });

  it('detects banned AI clichés', () => {
    const text = 'Let us delve into how this game-changer will revolutionize your coding workflow.';
    const result = lintScriptForSlop(text, 'standard');

    expect(result.bannedWordsFound).toContain('delve');
    expect(result.bannedWordsFound).toContain('game-changer');
    expect(result.bannedWordsFound).toContain('revolutionize');
    expect(result.passed).toBe(false);
  });

  it('penalizes verbose hooks beyond strictness threshold', () => {
    // 19 words hook
    const verbose = 'In this comprehensive technical walkthrough I am going to show you how modern database engines handle very high concurrency.';
    const standardRes = lintScriptForSlop(verbose, 'standard'); // max 15
    const lenientRes = lintScriptForSlop(verbose, 'lenient');   // max 18

    expect(standardRes.hookWordCount).toBeGreaterThan(15);
    expect(standardRes.warnings.some((w) => w.includes('too verbose'))).toBe(true);
    expect(lenientRes.warnings.some((w) => w.includes('too verbose'))).toBe(true);
  });

  it('enforces ruthless strictness profile threshold and hook budget', () => {
    // 14 words hook (passes standard max 15, fails ruthless max 12)
    const text = 'Postgres index scans fail silently today when queries skip the leading partition key in prod. Benchmark shows 40ms vs 2s.';
    const ruthlessRes = lintScriptForSlop(text, 'ruthless');
    const standardRes = lintScriptForSlop(text, 'standard');

    expect(standardRes.passed).toBe(true);
    // In ruthless, threshold is 85 and maxHookWords is 12
    expect(ruthlessRes.hookWordCount).toBeGreaterThan(12);
    expect(ruthlessRes.warnings.some((w) => w.includes('ruthless budget'))).toBe(true);
  });

  it('penalizes weak rhetorical questions', () => {
    const text = 'Have you ever wondered why your database takes so long to execute queries? Latency is 500ms.';
    const result = lintScriptForSlop(text, 'standard');

    expect(result.warnings.some((w) => w.includes('weak rhetorical question'))).toBe(true);
  });

  it('warns when no concrete proof or numbers are present', () => {
    const text = 'This tool makes everything faster and smoother for your entire team.';
    const result = lintScriptForSlop(text, 'standard');

    expect(result.hasConcreteProof).toBe(false);
    expect(result.warnings.some((w) => w.includes('No concrete proof anchor detected'))).toBe(true);
  });

  it('fails an empty script instead of scoring it as a pass', () => {
    const result = lintScriptForSlop('   ', 'standard');

    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
    expect(result.warnings[0]).toContain('Script is empty');
  });

  it('measures the explicit hook instead of merging it with the next sentence', () => {
    const text =
      'Your RAG demo dies at 10k documents Vector search collapses once the index grows past the cache boundary. Benchmark: 900ms.';
    const hook = 'Your RAG demo dies at 10k documents';

    const withHook = lintScriptForSlop(text, 'standard', hook);
    const withoutHook = lintScriptForSlop(text, 'standard');

    expect(withHook.hookWordCount).toBe(7);
    expect(withHook.warnings.some((w) => w.includes('too verbose'))).toBe(false);
    expect(withoutHook.hookWordCount).toBeGreaterThan(15);
  });

  it('does not treat substrings like "teams" as the "ms" proof anchor', () => {
    const result = lintScriptForSlop('Our teams ship systems to everyone.', 'standard');

    expect(result.hasConcreteProof).toBe(false);
  });

  it('recognizes numeric measurements as concrete proof', () => {
    const result = lintScriptForSlop('The indexing job finishes in 2.4s.', 'standard');

    expect(result.hasConcreteProof).toBe(true);
  });
});
