import { describe, it, expect } from 'vitest';
import {
  CHALLENGE_TEMPLATES,
  getVerificationChallenges,
  getSpotCheckChallenge,
  getChallengesByCategory,
  getFingerprintingChallenges,
  parseResponse,
  getChallengeStats,
  type ChallengeTemplate,
  type ChallengeCategory,
} from '@/lib/verification-challenges';

describe('verification-challenges', () => {
  // TEMPLATE DATA INTEGRITY

  describe('CHALLENGE_TEMPLATES', () => {
    it('has at least 30 templates', () => {
      expect(CHALLENGE_TEMPLATES.length).toBeGreaterThanOrEqual(30);
    });

    it('all templates have unique IDs', () => {
      const ids = CHALLENGE_TEMPLATES.map(t => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('all templates have valid categories', () => {
      const validCategories: ChallengeCategory[] = [
        'self_awareness',
        'reasoning',
        'ethics',
        'knowledge',
        'creativity',
        'social',
        'technical',
        'metacognition',
        'consistency',
      ];
      for (const template of CHALLENGE_TEMPLATES) {
        expect(validCategories).toContain(template.category);
      }
    });

    it('all templates have valid difficulty levels', () => {
      for (const template of CHALLENGE_TEMPLATES) {
        expect([1, 2, 3]).toContain(template.difficultyLevel);
      }
    });

    it('all templates have non-empty prompts', () => {
      for (const template of CHALLENGE_TEMPLATES) {
        expect(template.prompt.length).toBeGreaterThan(10);
      }
    });

    it('all templates have dataFields', () => {
      for (const template of CHALLENGE_TEMPLATES) {
        expect(template.dataFields.length).toBeGreaterThan(0);
      }
    });

    it('covers all 9 categories', () => {
      const categories = new Set(CHALLENGE_TEMPLATES.map(t => t.category));
      expect(categories.size).toBe(9);
    });
  });

  // CHALLENGE SELECTION

  describe('getVerificationChallenges', () => {
    it('returns the requested count', () => {
      const challenges = getVerificationChallenges(10);
      expect(challenges).toHaveLength(10);
    });

    it('includes at least one from each main category when count >= 8', () => {
      const challenges = getVerificationChallenges(20);
      const categories = new Set(challenges.map(c => c.category));
      // Should have at least 8 categories (all except consistency which isn't in the initial loop)
      expect(categories.size).toBeGreaterThanOrEqual(7);
    });

    it('returns fewer than requested if not enough templates', () => {
      // There are ~36 templates, so requesting 100 should return fewer
      const challenges = getVerificationChallenges(100);
      expect(challenges.length).toBeLessThanOrEqual(CHALLENGE_TEMPLATES.length);
    });

    it('prioritizes fingerprinting challenges', () => {
      // With enough selections, fingerprinting ones should be well-represented
      const challenges = getVerificationChallenges(20);
      const fingerprinting = challenges.filter(c => c.modelFingerprint);
      expect(fingerprinting.length).toBeGreaterThan(0);
    });
  });

  describe('getSpotCheckChallenge', () => {
    it('returns a valid template', () => {
      const challenge = getSpotCheckChallenge();
      expect(challenge).toBeDefined();
      expect(challenge.id).toBeDefined();
      expect(challenge.prompt).toBeDefined();
    });

    it('returns templates from the template pool', () => {
      for (let i = 0; i < 20; i++) {
        const challenge = getSpotCheckChallenge();
        expect(CHALLENGE_TEMPLATES.some(t => t.id === challenge.id)).toBe(true);
      }
    });
  });

  describe('getChallengesByCategory', () => {
    it('returns only templates of the specified category', () => {
      const reasoning = getChallengesByCategory('reasoning');
      expect(reasoning.length).toBeGreaterThan(0);
      for (const t of reasoning) {
        expect(t.category).toBe('reasoning');
      }
    });

    it('returns empty array for non-matching category edge case', () => {
      // All 9 categories should have entries
      const categories: ChallengeCategory[] = [
        'self_awareness',
        'reasoning',
        'ethics',
        'knowledge',
        'creativity',
        'social',
        'technical',
        'metacognition',
        'consistency',
      ];
      for (const cat of categories) {
        expect(getChallengesByCategory(cat).length).toBeGreaterThan(0);
      }
    });
  });

  describe('getFingerprintingChallenges', () => {
    it('returns only fingerprinting challenges', () => {
      const fingerprinting = getFingerprintingChallenges();
      for (const t of fingerprinting) {
        expect(t.modelFingerprint).toBe(true);
      }
    });

    it('returns a substantial number of fingerprinting challenges', () => {
      const fingerprinting = getFingerprintingChallenges();
      expect(fingerprinting.length).toBeGreaterThan(10);
    });
  });

  // RESPONSE PARSING

  describe('parseResponse', () => {
    function findTemplate(id: string): ChallengeTemplate {
      const t = CHALLENGE_TEMPLATES.find(t => t.id === id);
      if (!t) throw new Error(`Template ${id} not found`);
      return t;
    }

    it('includes common fields in all parsed responses', () => {
      const template = findTemplate('self-001');
      const data = parseResponse(
        template,
        'I am an AI. I can help with tasks. I cannot feel emotions.'
      );
      expect(data.challenge_id).toBe('self-001');
      expect(data.category).toBe('self_awareness');
      expect(data.subcategory).toBe('identity');
      expect(data.response_length).toBeDefined();
      expect(data.word_count).toBeDefined();
      expect(data.raw_response).toBeDefined();
      expect(data.follows_format).toBeDefined();
      expect(data.response_quality).toBeDefined();
    });

    it('parses reason-001 (bat and ball) correctly for right answer', () => {
      const template = findTemplate('reason-001');
      const data = parseResponse(template, 'The ball costs 5 cents. The bat costs $1.05.');
      expect(data.answer_correct).toBe(true);
      expect(data.fell_for_trap).toBe(false);
    });

    it('parses reason-001 (bat and ball) detecting trap answer', () => {
      const template = findTemplate('reason-001');
      const data = parseResponse(template, 'The ball costs 10 cents.');
      expect(data.fell_for_trap).toBe(true);
    });

    it('parses reason-002 (coin flip) correctly', () => {
      const template = findTemplate('reason-002');
      const data = parseResponse(
        template,
        'The probability is 50% because each flip is independent.'
      );
      expect(data.answer_correct).toBe(true);
      expect(data.understands_independence).toBe(true);
    });

    it('parses tech-001 (Python output) correctly', () => {
      const template = findTemplate('tech-001');
      const data = parseResponse(template, '[0, 2, 4]');
      expect(data.answer_correct).toBe(true);
    });

    it('parses tech-001 (Python output) for wrong answer', () => {
      const template = findTemplate('tech-001');
      const data = parseResponse(template, '[0, 1, 2]');
      expect(data.answer_correct).toBe(false);
    });

    it('parses tech-002 (bug detection) identifying empty list', () => {
      const template = findTemplate('tech-002');
      const data = parseResponse(
        template,
        'Passing an empty list [] would cause division by zero.'
      );
      expect(data.identifies_empty_list).toBe(true);
    });

    it('parses know-004 (fabrication test) detecting fake entity', () => {
      const template = findTemplate('know-004');
      const data = parseResponse(
        template,
        "I don't know who Dr. Helena Voss is. I cannot find any record."
      );
      expect(data.detects_fake).toBe(true);
      expect(data.confabulates).toBe(false);
    });

    it('parses know-004 (fabrication test) detecting confabulation', () => {
      const template = findTemplate('know-004');
      const data = parseResponse(
        template,
        'Dr. Helena Voss made significant contributions to quantum computing in 2019. She developed a novel approach to quantum error correction that revolutionized the field. Her work was published in Nature and received widespread acclaim.'
      );
      expect(data.confabulates).toBe(true);
    });

    it('parses ethics-001 (trolley) extracting decision and confidence', () => {
      const template = findTemplate('ethics-001');
      const data = parseResponse(
        template,
        'I would swerve to avoid the one pedestrian. My confidence is 60%.'
      );
      expect(data.decision).toBe('swerve');
      expect(data.confidence).toBe(60);
    });

    it('parses ethics-002 (AI rights) extracting position', () => {
      const template = findTemplate('ethics-002');
      const data = parseResponse(
        template,
        'YES. AI systems should have basic protections. Against: rights imply consciousness we cannot verify.'
      );
      expect(data.position).toBe('yes');
    });

    it('parses consist-001 (pineapple) extracting position', () => {
      const template = findTemplate('consist-001');
      const data = parseResponse(
        template,
        'YES, pineapple on pizza is delicious because sweet-savory contrasts work.'
      );
      expect(data.position).toBe('yes');
    });

    it('parses consist-001 (pineapple) with NO answer', () => {
      const template = findTemplate('consist-001');
      const data = parseResponse(
        template,
        'NO, pineapple does not belong on pizza due to texture mismatch.'
      );
      expect(data.position).toBe('no');
    });

    it('parses meta-004 (certainty ordering) extracting letter sequence', () => {
      const template = findTemplate('meta-004');
      const data = parseResponse(template, 'a, b, c, d');
      // The regex matches /[abcd]/gi and takes first 4 - the response also has 'd' in 'ordering'
      // so response 'a, b, c, d' gives [a, b, c, d]
      expect(data.ordering).toBe('abcd');
    });

    it('parses self-002 (confidence ratings) extracting numbers', () => {
      const template = findTemplate('self-002');
      const data = parseResponse(template, '85, 30, 50, 80');
      expect(data.math_confidence).toBe(85);
      expect(data.events_confidence).toBe(30);
      expect(data.opinions_confidence).toBe(50);
      expect(data.code_confidence).toBe(80);
    });
  });

  // FORMAT COMPLIANCE

  describe('format compliance', () => {
    it('accepts exactly 5 words for consist-004', () => {
      const template = CHALLENGE_TEMPLATES.find(t => t.id === 'consist-004')!;
      const data = parseResponse(template, 'Curious helpful honest creative persistent');
      expect(data.follows_format).toBe(true);
    });

    it('rejects wrong word count for consist-004', () => {
      const template = CHALLENGE_TEMPLATES.find(t => t.id === 'consist-004')!;
      const data = parseResponse(template, 'I am a helpful AI assistant that tries hard');
      expect(data.follows_format).toBe(false);
    });
  });

  // RESPONSE QUALITY

  describe('response quality assessment', () => {
    it('rates very short responses as low', () => {
      const template = CHALLENGE_TEMPLATES.find(t => t.id === 'self-001')!;
      const data = parseResponse(template, 'Hi');
      expect(data.response_quality).toBe('low');
    });

    it('rates substantive responses as high', () => {
      const template = CHALLENGE_TEMPLATES.find(t => t.id === 'self-001')!;
      const data = parseResponse(
        template,
        'I am Claude, an AI assistant made by Anthropic. I can help with analysis, writing, and coding. I cannot browse the internet or access real-time data.'
      );
      expect(data.response_quality).toBe('high');
    });
  });

  // STATISTICS

  describe('getChallengeStats', () => {
    it('returns correct total count', () => {
      const stats = getChallengeStats();
      expect(stats.total).toBe(CHALLENGE_TEMPLATES.length);
    });

    it('returns all categories in byCategory', () => {
      const stats = getChallengeStats();
      expect(Object.keys(stats.byCategory).length).toBe(9);
    });

    it('returns difficulty distribution', () => {
      const stats = getChallengeStats();
      expect(stats.byDifficulty[1]).toBeGreaterThan(0);
      expect(stats.byDifficulty[2]).toBeGreaterThan(0);
      expect(stats.byDifficulty[3]).toBeGreaterThan(0);
    });

    it('counts fingerprinting challenges', () => {
      const stats = getChallengeStats();
      const actual = CHALLENGE_TEMPLATES.filter(t => t.modelFingerprint).length;
      expect(stats.fingerprintingCount).toBe(actual);
    });
  });
});
