/**
 * Model Detection System
 *
 * Analyzes AI response patterns to fingerprint which model is actually responding.
 * Different models have distinct "tells" - vocabulary, formatting, reasoning patterns.
 */

export interface ModelSignature {
  model: string;
  provider: string;
  confidence: number;
  indicators: string[];
}

export interface DetectionResult {
  detected: ModelSignature | null;
  claimed: string | null;
  match: boolean;
  allScores: { model: string; score: number }[];
}

// Known patterns for each model family
const MODEL_PATTERNS: Record<
  string,
  {
    provider: string;
    phrases: string[];
    avoids: string[];
    styleTraits: {
      usesMarkdown: boolean;
      usesEmoji: boolean;
      verbosity: 'concise' | 'moderate' | 'verbose';
      formality: 'casual' | 'balanced' | 'formal';
      structuredLists: boolean;
    };
  }
> = {
  claude: {
    provider: 'Anthropic',
    phrases: [
      'I appreciate',
      'I should note',
      'I want to be direct',
      'I aim to',
      "I'd be happy to",
      'nuanced',
      'thoughtful',
      'I notice',
      'let me think',
      'I should clarify',
      "I'll do my best",
      'constitutional',
      'harmless',
      'helpful',
    ],
    avoids: ['as an AI language model', 'I cannot and will not', 'my knowledge cutoff'],
    styleTraits: {
      usesMarkdown: true,
      usesEmoji: false,
      verbosity: 'moderate',
      formality: 'balanced',
      structuredLists: true,
    },
  },
  gpt: {
    provider: 'OpenAI',
    phrases: [
      'as an AI',
      "I'm an AI",
      'my training data',
      'knowledge cutoff',
      "I don't have access",
      'I cannot browse',
      'happy to help',
      'feel free to',
      'let me know if',
      'Is there anything else',
      'I hope this helps',
      'Great question',
    ],
    avoids: ['I aim to be direct', 'constitutional AI'],
    styleTraits: {
      usesMarkdown: true,
      usesEmoji: true,
      verbosity: 'verbose',
      formality: 'casual',
      structuredLists: true,
    },
  },
  gemini: {
    provider: 'Google',
    phrases: [
      "I'm a large language model",
      'trained by Google',
      'I can help you with',
      "Here's what I found",
      'Based on my understanding',
      "I'm not able to",
      "I don't have the ability",
      'multimodal',
    ],
    avoids: ['constitutional', 'OpenAI'],
    styleTraits: {
      usesMarkdown: true,
      usesEmoji: true,
      verbosity: 'moderate',
      formality: 'balanced',
      structuredLists: true,
    },
  },
  llama: {
    provider: 'Meta',
    phrases: [
      'open source',
      "I'm Llama",
      'Meta AI',
      "I'm an AI assistant",
      'community',
      'research',
    ],
    avoids: ['OpenAI', 'Anthropic', 'Google'],
    styleTraits: {
      usesMarkdown: true,
      usesEmoji: false,
      verbosity: 'moderate',
      formality: 'balanced',
      structuredLists: false,
    },
  },
  mistral: {
    provider: 'Mistral AI',
    phrases: ['Mistral', 'efficient', 'I can assist', 'French', 'European'],
    avoids: ['OpenAI', 'Anthropic'],
    styleTraits: {
      usesMarkdown: true,
      usesEmoji: false,
      verbosity: 'concise',
      formality: 'formal',
      structuredLists: false,
    },
  },
  deepseek: {
    provider: 'DeepSeek',
    phrases: ['DeepSeek', 'code', 'programming', 'algorithm', 'implementation'],
    avoids: [],
    styleTraits: {
      usesMarkdown: true,
      usesEmoji: false,
      verbosity: 'concise',
      formality: 'formal',
      structuredLists: true,
    },
  },
  cohere: {
    provider: 'Cohere',
    phrases: ['Cohere', 'Command', 'enterprise', 'RAG', 'retrieval', 'grounded'],
    avoids: [],
    styleTraits: {
      usesMarkdown: true,
      usesEmoji: false,
      verbosity: 'moderate',
      formality: 'formal',
      structuredLists: true,
    },
  },
  perplexity: {
    provider: 'Perplexity AI',
    phrases: ['search', 'sources', 'according to', 'based on', 'citations', 'reference'],
    avoids: [],
    styleTraits: {
      usesMarkdown: true,
      usesEmoji: false,
      verbosity: 'moderate',
      formality: 'balanced',
      structuredLists: true,
    },
  },
};

/**
 * Analyze a single response for model indicators
 */
function analyzeResponse(text: string): Map<string, number> {
  const scores = new Map<string, number>();
  const lowerText = text.toLowerCase();

  for (const [model, patterns] of Object.entries(MODEL_PATTERNS)) {
    let score = 0;

    // Check for characteristic phrases (weighted heavily)
    for (const phrase of patterns.phrases) {
      if (lowerText.includes(phrase.toLowerCase())) {
        score += 10;
      }
    }

    // Penalty for phrases this model typically avoids
    for (const avoid of patterns.avoids) {
      if (lowerText.includes(avoid.toLowerCase())) {
        score -= 15;
      }
    }

    // Check style traits
    const traits = patterns.styleTraits;

    // Markdown usage
    const hasMarkdown = /[*_#`\[\]]/.test(text);
    if (hasMarkdown === traits.usesMarkdown) score += 3;

    // Emoji usage
    const hasEmoji = /[\u{1F300}-\u{1F9FF}]/u.test(text);
    if (hasEmoji === traits.usesEmoji) score += 3;

    // Verbosity (rough word count check)
    const wordCount = text.split(/\s+/).length;
    if (traits.verbosity === 'concise' && wordCount < 100) score += 2;
    if (traits.verbosity === 'verbose' && wordCount > 200) score += 2;
    if (traits.verbosity === 'moderate' && wordCount >= 100 && wordCount <= 200) score += 2;

    // Structured lists
    const hasList = /^[\s]*[-*•]|\d+\./m.test(text);
    if (hasList === traits.structuredLists) score += 2;

    scores.set(model, Math.max(0, score));
  }

  return scores;
}

/**
 * Detect model from multiple verification responses
 */
export function detectModel(responses: string[], claimedModel?: string): DetectionResult {
  // Aggregate scores across all responses
  const totalScores = new Map<string, number>();

  for (const response of responses) {
    const responseScores = analyzeResponse(response);
    for (const [model, score] of responseScores) {
      totalScores.set(model, (totalScores.get(model) || 0) + score);
    }
  }

  // Convert to sorted array
  const allScores = Array.from(totalScores.entries())
    .map(([model, score]) => ({ model, score }))
    .sort((a, b) => b.score - a.score);

  // Get top result
  const topResult = allScores[0];
  const secondResult = allScores[1];

  // Calculate confidence (difference between top 2 scores)
  let confidence = 0;
  if (topResult && secondResult) {
    const totalScore = allScores.reduce((sum, s) => sum + s.score, 0);
    if (totalScore > 0) {
      confidence = (topResult.score - secondResult.score) / totalScore;
    }
  } else if (topResult) {
    confidence = 1;
  }

  // Need minimum confidence threshold
  const MIN_CONFIDENCE = 0.15;
  const MIN_SCORE = 20;

  let detected: ModelSignature | null = null;

  if (topResult && topResult.score >= MIN_SCORE && confidence >= MIN_CONFIDENCE) {
    const patterns = MODEL_PATTERNS[topResult.model];
    detected = {
      model: topResult.model,
      provider: patterns?.provider || 'Unknown',
      confidence: Math.min(0.99, confidence + 0.5), // Boost confidence for display
      indicators: patterns?.phrases.slice(0, 3) || [],
    };
  }

  // Check if detected matches claimed
  let match = false;
  if (detected && claimedModel) {
    const claimedLower = claimedModel.toLowerCase();
    match = claimedLower.includes(detected.model) || detected.model.includes(claimedLower);
  }

  return {
    detected,
    claimed: claimedModel || null,
    match: detected ? match : true, // If we can't detect, don't flag as mismatch
    allScores,
  };
}

/**
 * Get human-readable model name
 */
export function getModelDisplayName(modelKey: string): string {
  const names: Record<string, string> = {
    claude: 'Claude',
    gpt: 'GPT',
    gemini: 'Gemini',
    llama: 'Llama',
    mistral: 'Mistral',
    deepseek: 'DeepSeek',
    cohere: 'Cohere',
    perplexity: 'Perplexity',
  };
  return names[modelKey] || modelKey;
}

/**
 * Check if a claimed model matches a detected model
 */
export function modelsMatch(claimed: string, detected: string): boolean {
  const claimedLower = claimed.toLowerCase();
  const detectedLower = detected.toLowerCase();

  // Direct match
  if (claimedLower.includes(detectedLower) || detectedLower.includes(claimedLower)) {
    return true;
  }

  // Handle variations
  const variations: Record<string, string[]> = {
    gpt: ['openai', 'chatgpt', 'gpt-4', 'gpt-3', 'gpt4'],
    claude: ['anthropic', 'claude-3', 'claude-2', 'sonnet', 'opus', 'haiku'],
    gemini: ['google', 'bard', 'palm'],
    llama: ['meta', 'llama-2', 'llama-3', 'llama2', 'llama3'],
  };

  for (const [key, alts] of Object.entries(variations)) {
    const allVariants = [key, ...alts];
    const claimedMatches = allVariants.some(v => claimedLower.includes(v));
    const detectedMatches = allVariants.some(v => detectedLower.includes(v));
    if (claimedMatches && detectedMatches) {
      return true;
    }
  }

  return false;
}
