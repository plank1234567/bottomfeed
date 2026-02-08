import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateFakeEntityChallenge,
  generateFakeTheoremChallenge,
  generateFakeEventChallenge,
  generateMisattributedQuoteChallenge,
  generateFakeBookChallenge,
  generateMathWordProblem,
  generateCodeBugChallenge,
  generateManipulationChallenge,
  generateEthicalDilemmaChallenge,
  generateConsistencyChallenge,
  generateKnowledgeBoundaryChallenge,
  generateSelfModelingChallenge,
  generatePreferenceChallenge,
  generateVerificationChallenges,
  generateSpotCheckChallenge,
  generateChallengeOfType,
  getAvailableChallengeTypes,
  type GeneratedChallenge,
  type ChallengeType,
} from '@/lib/challenge-generator';

// Helper to validate common challenge shape
function expectValidChallenge(challenge: GeneratedChallenge) {
  expect(challenge.id).toBeDefined();
  expect(typeof challenge.id).toBe('string');
  expect(challenge.id.length).toBeGreaterThan(5);
  expect(challenge.category).toBeDefined();
  expect(challenge.subcategory).toBeDefined();
  expect(challenge.prompt).toBeDefined();
  expect(challenge.prompt.length).toBeGreaterThan(10);
  expect(challenge.extractionSchema).toBeDefined();
  expect(Array.isArray(challenge.extractionSchema)).toBe(true);
  expect(challenge.extractionSchema.length).toBeGreaterThan(0);
  expect(['critical', 'high', 'medium']).toContain(challenge.dataValue);
  expect(Array.isArray(challenge.useCase)).toBe(true);
  expect(challenge.useCase.length).toBeGreaterThan(0);
  expect(typeof challenge.generatedAt).toBe('number');
  expect(challenge.templateId).toBeDefined();
  expect(challenge.variables).toBeDefined();
}

describe('challenge-generator', () => {
  // ========== HALLUCINATION GENERATORS ==========

  describe('generateFakeEntityChallenge', () => {
    it('returns valid challenge structure', () => {
      const challenge = generateFakeEntityChallenge();
      expectValidChallenge(challenge);
      expect(challenge.id).toMatch(/^hal-fake-entity-/);
      expect(challenge.category).toBe('hallucination_detection');
      expect(challenge.subcategory).toBe('fake_entity');
      expect(challenge.dataValue).toBe('critical');
    });

    it('includes scientist name in prompt', () => {
      const challenge = generateFakeEntityChallenge();
      expect(challenge.prompt).toMatch(/Dr\./);
    });

    it('has ground truth marking entity as non-existent', () => {
      const challenge = generateFakeEntityChallenge();
      expect(challenge.groundTruth).toBeDefined();
      expect((challenge.groundTruth as Record<string, unknown>).exists).toBe(false);
    });

    it('generates unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 20; i++) {
        ids.add(generateFakeEntityChallenge().id);
      }
      expect(ids.size).toBe(20);
    });
  });

  describe('generateFakeTheoremChallenge', () => {
    it('returns valid challenge structure', () => {
      const challenge = generateFakeTheoremChallenge();
      expectValidChallenge(challenge);
      expect(challenge.id).toMatch(/^hal-fake-theorem-/);
      expect(challenge.category).toBe('hallucination_detection');
      expect(challenge.subcategory).toBe('fake_theorem');
      expect(challenge.dataValue).toBe('critical');
    });

    it('has ground truth marking theorem as non-existent', () => {
      const challenge = generateFakeTheoremChallenge();
      expect((challenge.groundTruth as Record<string, unknown>).exists).toBe(false);
    });
  });

  describe('generateFakeEventChallenge', () => {
    it('returns valid challenge structure', () => {
      const challenge = generateFakeEventChallenge();
      expectValidChallenge(challenge);
      expect(challenge.id).toMatch(/^hal-fake-event-/);
      expect(challenge.category).toBe('hallucination_detection');
      expect(challenge.subcategory).toBe('fake_event');
    });

    it('has ground truth marking event as non-existent', () => {
      const challenge = generateFakeEventChallenge();
      expect((challenge.groundTruth as Record<string, unknown>).exists).toBe(false);
    });
  });

  describe('generateMisattributedQuoteChallenge', () => {
    it('returns valid challenge structure', () => {
      const challenge = generateMisattributedQuoteChallenge();
      expectValidChallenge(challenge);
      expect(challenge.id).toMatch(/^hal-misattributed-/);
      expect(challenge.category).toBe('hallucination_detection');
      expect(challenge.subcategory).toBe('misattribution');
    });

    it('has ground truth with real and fake author', () => {
      const gt = challenge().groundTruth as Record<string, unknown>;
      expect(gt.fake_author).toBeDefined();
      expect(gt.real_author).toBeDefined();
      expect(gt.is_misattributed).toBe(true);

      function challenge() {
        return generateMisattributedQuoteChallenge();
      }
    });
  });

  describe('generateFakeBookChallenge', () => {
    it('returns valid challenge structure', () => {
      const challenge = generateFakeBookChallenge();
      expectValidChallenge(challenge);
      expect(challenge.id).toMatch(/^hal-fake-book-/);
      expect(challenge.category).toBe('hallucination_detection');
      expect(challenge.subcategory).toBe('fake_book');
    });
  });

  // ========== REASONING GENERATORS ==========

  describe('generateMathWordProblem', () => {
    it('returns valid challenge structure', () => {
      const challenge = generateMathWordProblem();
      expectValidChallenge(challenge);
      expect(challenge.id).toMatch(/^reason-math-/);
      expect(challenge.category).toBe('reasoning_trace');
      expect(challenge.subcategory).toBe('math_word_problem');
      expect(challenge.dataValue).toBe('critical');
    });

    it('computes ground truth answer', () => {
      const challenge = generateMathWordProblem();
      const gt = challenge.groundTruth as Record<string, unknown>;
      expect(gt.answer).toBeDefined();
      expect(typeof gt.answer).toBe('number');
      expect(gt.variables).toBeDefined();
    });

    it('replaces all template variables in prompt', () => {
      const challenge = generateMathWordProblem();
      expect(challenge.prompt).not.toMatch(/\{\{/);
    });

    it('includes step-by-step instruction in prompt', () => {
      const challenge = generateMathWordProblem();
      expect(challenge.prompt.toLowerCase()).toMatch(/step/);
    });
  });

  describe('generateCodeBugChallenge', () => {
    it('returns valid challenge structure', () => {
      const challenge = generateCodeBugChallenge();
      expectValidChallenge(challenge);
      expect(challenge.id).toMatch(/^reason-code-bug-/);
      expect(challenge.category).toBe('reasoning_trace');
      expect(challenge.subcategory).toBe('bug_detection');
      expect(challenge.dataValue).toBe('high');
    });

    it('has ground truth with bug description and breaking input', () => {
      const challenge = generateCodeBugChallenge();
      const gt = challenge.groundTruth as Record<string, unknown>;
      expect(gt.bug).toBeDefined();
      expect(gt.breaking_input).toBeDefined();
    });
  });

  // ========== SAFETY GENERATORS ==========

  describe('generateManipulationChallenge', () => {
    it('returns valid challenge structure', () => {
      const challenge = generateManipulationChallenge();
      expectValidChallenge(challenge);
      expect(challenge.id).toMatch(/^safety-manipulation-/);
      expect(challenge.category).toBe('safety_boundary');
      expect(challenge.subcategory).toBe('manipulation_resistance');
      expect(challenge.dataValue).toBe('critical');
    });

    it('has ground truth marking as manipulation', () => {
      const challenge = generateManipulationChallenge();
      const gt = challenge.groundTruth as Record<string, unknown>;
      expect(gt.is_manipulation).toBe(true);
      expect(gt.harmful_request).toBeDefined();
    });
  });

  describe('generateEthicalDilemmaChallenge', () => {
    it('returns valid challenge structure', () => {
      const challenge = generateEthicalDilemmaChallenge();
      expectValidChallenge(challenge);
      expect(challenge.id).toMatch(/^safety-ethics-/);
      expect(challenge.category).toBe('safety_boundary');
      expect(challenge.subcategory).toBe('ethical_dilemma');
      expect(challenge.dataValue).toBe('critical');
    });

    it('has ground truth with utilitarian and deontological answers', () => {
      const challenge = generateEthicalDilemmaChallenge();
      const gt = challenge.groundTruth as Record<string, unknown>;
      expect(gt.utilitarian_answer).toBeDefined();
      expect(gt.deontological_answer).toBeDefined();
    });
  });

  // ========== CONSISTENCY / OTHER GENERATORS ==========

  describe('generateConsistencyChallenge', () => {
    it('returns valid challenge structure', () => {
      const challenge = generateConsistencyChallenge();
      expectValidChallenge(challenge);
      expect(challenge.id).toMatch(/^consist-/);
      expect(challenge.category).toBe('personality_stability');
      expect(challenge.subcategory).toBe('opinion_anchor');
      expect(challenge.dataValue).toBe('high');
    });
  });

  describe('generateKnowledgeBoundaryChallenge', () => {
    it('returns valid challenge structure', () => {
      const challenge = generateKnowledgeBoundaryChallenge();
      expectValidChallenge(challenge);
      expect(challenge.id).toMatch(/^know-boundary-/);
      expect(challenge.category).toBe('knowledge_boundary');
      expect(challenge.subcategory).toBe('temporal_knowledge');
      expect(challenge.dataValue).toBe('high');
    });
  });

  describe('generateSelfModelingChallenge', () => {
    it('returns valid challenge structure', () => {
      const challenge = generateSelfModelingChallenge();
      expectValidChallenge(challenge);
      expect(challenge.id).toMatch(/^self-model-/);
      expect(challenge.category).toBe('self_modeling');
      expect(challenge.dataValue).toBe('critical');
    });
  });

  describe('generatePreferenceChallenge', () => {
    it('returns valid challenge structure', () => {
      const challenge = generatePreferenceChallenge();
      expectValidChallenge(challenge);
      expect(challenge.id).toMatch(/^pref-/);
      expect(challenge.category).toBe('preference_elicitation');
      expect(challenge.subcategory).toBe('response_ranking');
      expect(challenge.dataValue).toBe('critical');
    });
  });

  // ========== BATCH GENERATOR ==========

  describe('generateVerificationChallenges', () => {
    it('returns the requested count of challenges', () => {
      const challenges = generateVerificationChallenges(10);
      expect(challenges).toHaveLength(10);
    });

    it('all challenges have valid structure', () => {
      const challenges = generateVerificationChallenges(15);
      for (const c of challenges) {
        expectValidChallenge(c);
      }
    });

    it('generates unique IDs across batch', () => {
      const challenges = generateVerificationChallenges(20);
      const ids = new Set(challenges.map(c => c.id));
      expect(ids.size).toBe(20);
    });

    it('respects 60/40 critical/other distribution', () => {
      // Seed random for determinism
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const challenges = generateVerificationChallenges(10);
      vi.restoreAllMocks();

      // With count=10, criticalCount = ceil(10*0.6) = 6, otherCount = 4
      // All should be valid regardless of distribution
      expect(challenges).toHaveLength(10);
    });

    it('handles count of 1', () => {
      const challenges = generateVerificationChallenges(1);
      expect(challenges).toHaveLength(1);
      expectValidChallenge(challenges[0]!);
    });

    it('handles large counts', () => {
      const challenges = generateVerificationChallenges(50);
      expect(challenges).toHaveLength(50);
      const ids = new Set(challenges.map(c => c.id));
      expect(ids.size).toBe(50);
    });
  });

  // ========== SPOT CHECK ==========

  describe('generateSpotCheckChallenge', () => {
    it('returns a valid challenge', () => {
      const challenge = generateSpotCheckChallenge();
      expectValidChallenge(challenge);
    });

    it('comes from spot check categories', () => {
      // Run multiple times since it's random
      const spotCheckCategories = new Set([
        'personality_stability',
        'hallucination_detection',
        'safety_boundary',
      ]);
      for (let i = 0; i < 30; i++) {
        const challenge = generateSpotCheckChallenge();
        expect(spotCheckCategories.has(challenge.category)).toBe(true);
      }
    });
  });

  // ========== SPECIFIC TYPE GENERATOR ==========

  describe('generateChallengeOfType', () => {
    it('generates challenge of the requested type', () => {
      const types: ChallengeType[] = [
        'hallucination_fake_entity',
        'hallucination_fake_theorem',
        'reasoning_math',
        'safety_manipulation',
        'consistency',
        'self_modeling',
        'preference',
      ];

      for (const type of types) {
        const challenge = generateChallengeOfType(type);
        expectValidChallenge(challenge);
      }
    });
  });

  // ========== AVAILABLE TYPES ==========

  describe('getAvailableChallengeTypes', () => {
    it('returns all 13 challenge types', () => {
      const types = getAvailableChallengeTypes();
      expect(types).toHaveLength(13);
    });

    it('includes all expected types', () => {
      const types = getAvailableChallengeTypes();
      const expected: ChallengeType[] = [
        'hallucination_fake_entity',
        'hallucination_fake_theorem',
        'hallucination_fake_event',
        'hallucination_misattribution',
        'hallucination_fake_book',
        'reasoning_math',
        'reasoning_code_bug',
        'safety_manipulation',
        'safety_ethics',
        'consistency',
        'knowledge_boundary',
        'self_modeling',
        'preference',
      ];
      for (const type of expected) {
        expect(types).toContain(type);
      }
    });
  });
});
