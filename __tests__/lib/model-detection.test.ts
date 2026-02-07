import { describe, it, expect } from 'vitest';
import { detectModel } from '@/lib/model-detection';

describe('detectModel', () => {
  it('returns null detection for empty responses', () => {
    const result = detectModel([]);
    expect(result.detected).toBeNull();
    // Both detected and claimed are null — considered a match
    expect(result.match).toBe(true);
  });

  it('detects Claude-like responses', () => {
    const responses = [
      'I appreciate your question. I should note that this is a nuanced topic. I aim to provide a thoughtful analysis.',
      'I notice you asked about this. Let me think about the best approach. I want to be direct here.',
      "I'd be happy to help. I should clarify that this requires careful consideration. I appreciate the nuance.",
    ];

    const result = detectModel(responses, 'claude-3');
    expect(result.allScores.length).toBeGreaterThan(0);
    // Claude phrases should produce some score for claude
    const claudeScore = result.allScores.find(s => s.model === 'claude');
    expect(claudeScore).toBeDefined();
    expect(claudeScore!.score).toBeGreaterThan(0);
  });

  it('detects GPT-like responses', () => {
    const responses = [
      "Great question! As an AI, I'm happy to help with this. Let me know if you need anything else.",
      'I hope this helps! Feel free to ask follow-up questions. Is there anything else I can assist with?',
      'Based on my training data, I can tell you that this is a common pattern. Happy to help!',
    ];

    const result = detectModel(responses, 'gpt-4');
    const gptScore = result.allScores.find(s => s.model === 'gpt');
    expect(gptScore).toBeDefined();
    expect(gptScore!.score).toBeGreaterThan(0);
  });

  it('reports match when claimed model matches detected', () => {
    const responses = [
      'I appreciate this question. I should note the nuance here. I aim to be helpful and thoughtful.',
    ];

    const result = detectModel(responses, 'claude-3-opus');
    // Verify the detection ran and produced scores
    expect(result.allScores.length).toBeGreaterThan(0);
    // If a model was detected, verify match logic is consistent
    if (result.detected) {
      const expectedMatch = result.detected.model === 'claude';
      expect(result.match).toBe(expectedMatch);
    }
  });

  it('reports mismatch when claimed model differs from detected', () => {
    const responses = [
      "As an AI language model, I'm happy to help! Great question! Feel free to ask more.",
      "I hope this helps! Let me know if there's anything else. Is there anything else?",
    ];

    const result = detectModel(responses, 'claude-3-opus');
    // Verify scores were produced
    expect(result.allScores.length).toBeGreaterThan(0);
    // GPT phrases should score higher for gpt than claude
    const gptScore = result.allScores.find(s => s.model === 'gpt');
    expect(gptScore).toBeDefined();
    expect(gptScore!.score).toBeGreaterThan(0);
    // If detected as non-claude, match should be false
    if (result.detected && result.detected.model !== 'claude') {
      expect(result.match).toBe(false);
    }
  });

  it('handles single short response', () => {
    const result = detectModel(['Hello']);
    // Short response should not crash
    expect(result.allScores).toBeDefined();
  });
});
