import { describe, it, expect } from 'vitest';
import { extractJson, validateAngles, validateSeries } from '../src/core/parse';

describe('parse and validation', () => {
  describe('extractJson', () => {
    it('parses plain JSON object', () => {
      const input = '{"test": 123}';
      expect(extractJson(input)).toEqual({ test: 123 });
    });

    it('strips markdown code fences', () => {
      const input = '```json\n{"angles": [{"title": "Demo"}]}\n```';
      expect(extractJson(input)).toEqual({ angles: [{ title: 'Demo' }] });
    });

    it('scans and extracts JSON amidst conversational preamble and postamble', () => {
      const input = `Sure, here are your requested brainstorming angles:
{"angles": [{"title": "Deep Dive"}]}
Hope that helps! Let me know if you need more.`;
      expect(extractJson(input)).toEqual({ angles: [{ title: 'Deep Dive' }] });
    });

    it('repairs trailing commas', () => {
      const input = '{"angles": [{"title": "Demo",},],}';
      expect(extractJson(input)).toEqual({ angles: [{ title: 'Demo' }] });
    });

    it('throws MitosError when no JSON exists', () => {
      expect(() => extractJson('Just a text response with no JSON')).toThrow('No JSON object');
    });

    it('ignores braces in trailing prose after the payload', () => {
      const input = '{"angles": [{"title": "Deep Dive"}]}\nLet me know if you need {more}.';
      expect(extractJson(input)).toEqual({ angles: [{ title: 'Deep Dive' }] });
    });

    it('ignores bracket examples in the preamble', () => {
      const input = 'Here are [3] angles:\n{"angles": [{"title": "Demo"}]}';
      expect(extractJson(input)).toEqual({ angles: [{ title: 'Demo' }] });
    });

    it('does not truncate on JSON braces inside string values', () => {
      const input = '{"hook": "use {curly} and [brackets]", "score": 91}';
      expect(extractJson(input)).toEqual({ hook: 'use {curly} and [brackets]', score: 91 });
    });

    it('parses a top-level array payload', () => {
      const input = 'Sure:\n[{"title": "One"}, {"title": "Two"}]';
      expect(extractJson(input)).toEqual([{ title: 'One' }, { title: 'Two' }]);
    });
  });

  describe('validateAngles', () => {
    it('normalizes angles and calculates slop lint', () => {
      const raw = {
        angles: [
          {
            angleType: 'pain_point',
            title: 'RAG Failure',
            hook: 'Your RAG demo dies at 10k documents.',
            coreTension: 'Memory limit exceeded',
            visualProofAnchor: 'latency graph showing 40ms vs 2s',
            openLoop: 'Next episode',
          },
        ],
      };

      const angles = validateAngles(raw, 'standard');
      expect(angles).toHaveLength(1);
      expect(angles[0].id).toBe('angle-1');
      expect(angles[0].angleType).toBe('pain_point');
      expect(angles[0].lint.passed).toBe(true);
    });

    it('throws if angles array is missing or empty', () => {
      expect(() => validateAngles({ angles: [] })).toThrow('No angles found');
    });

    it('throws if an angle is missing a hook', () => {
      expect(() =>
        validateAngles({
          angles: [{ title: 'Bad Angle', hook: '' }],
        })
      ).toThrow('missing a hook');
    });

    it('lints the hook without absorbing the following core tension', () => {
      const raw = {
        angles: [
          {
            angleType: 'teardown',
            title: 'Index growth',
            hook: 'Your RAG demo dies at 10k documents',
            coreTension: 'Vector search collapses once the index grows past the cache boundary.',
            visualProofAnchor: 'benchmark: p95 900ms',
            openLoop: 'Next: tiered indexing.',
          },
        ],
      };

      const angles = validateAngles(raw, 'standard');
      expect(angles[0].lint.hookWordCount).toBe(7);
      expect(angles[0].lint.hasConcreteProof).toBe(true);
    });
  });

  describe('validateSeries', () => {
    it('validates a correct 3-episode series blueprint', () => {
      const raw = {
        series_title: 'Scaling Vector Search',
        premise: 'How naive search dies under load and the fix',
        archetype: '3_act_engineering_problem',
        episodes: [
          {
            n: 1,
            title: 'The Wall',
            hook: 'Your RAG demo dies at 10k documents.',
            coreTension: 'Cache miss storm',
            visualProofAnchor: 'p95 latency 9.1s in terminal',
            cliffhanger: 'The secret is index tiering.',
            payoff_from_prev: '',
          },
          {
            n: 2,
            title: 'The Tiered Solution',
            hook: 'Single index similarity is an architectural trap.',
            coreTension: 'Memory pressure vs recall',
            visualProofAnchor: 'code diff of two-tiered index',
            cliffhanger: 'Now let us test it at 100k scale.',
            payoff_from_prev: 'Tiering splits cold vectors from hot cache.',
          },
          {
            n: 3,
            title: 'The Benchmark',
            hook: 'We pushed 100k embeddings through production.',
            coreTension: 'Cost vs p99 throughput',
            visualProofAnchor: 'benchmark report: 30ms latency achieved',
            cliffhanger: 'Deploy this before your next release.',
            payoff_from_prev: '100k embeddings benchmark proves stability.',
          },
        ],
      };

      const series = validateSeries(raw, 'standard');
      expect(series.series_title).toBe('Scaling Vector Search');
      expect(series.episodes).toHaveLength(3);
      expect(series.episodes[1].payoff_from_prev).toBeTruthy();
    });

    it('rejects series where episode > 1 is missing payoff_from_prev', () => {
      const raw = {
        series_title: 'Bad Series',
        episodes: [
          { n: 1, title: 'Ep 1', hook: 'Hook one goes here.', payoff_from_prev: '' },
          { n: 2, title: 'Ep 2', hook: 'Hook two goes here.', payoff_from_prev: '' }, // Missing!
        ],
      };

      expect(() => validateSeries(raw)).toThrow('missing payoff_from_prev');
    });

    it('rejects series where episodes share duplicate hooks (Jaccard >= 0.7)', () => {
      const raw = {
        series_title: 'Duplicate Hooks Series',
        episodes: [
          { n: 1, title: 'Ep 1', hook: 'Your vector search crashes at scale today.', payoff_from_prev: '' },
          { n: 2, title: 'Ep 2', hook: 'Your vector search crashes at scale today.', payoff_from_prev: 'Resolved Ep 1' },
        ],
      };

      expect(() => validateSeries(raw)).toThrow('nearly identical hooks');
    });

    it('normalizes episode numbering to the 1-based position in the arc', () => {
      const raw = {
        series_title: 'Misnumbered Series',
        episodes: [
          { n: 7, title: 'Ep 1', hook: 'First hook about cache misses.', payoff_from_prev: '' },
          { n: 42, title: 'Ep 2', hook: 'Second hook about tiered indexes.', payoff_from_prev: 'Fixed Ep 1' },
        ],
      };

      const series = validateSeries(raw);
      expect(series.episodes.map((ep) => ep.n)).toEqual([1, 2]);
    });

    it('falls back to the default archetype and clamps cadence', () => {
      const raw = {
        series_title: 'Fallback Series',
        archetype: 'not_a_real_archetype',
        cadenceDays: 'every other day',
        episodes: [
          { n: 1, title: 'Ep 1', hook: 'First hook about cache misses.', payoff_from_prev: '' },
        ],
      };

      const series = validateSeries(raw);
      expect(series.archetype).toBe('3_act_engineering_problem');
      expect(series.cadenceDays).toBe(2);
    });
  });
});
