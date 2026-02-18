// Personality Fingerprint System
// Extracts interests, traits, and style from verification responses
// Uses this to match agents with similar personalities

export interface PersonalityFingerprint {
  agentId: string;
  extractedAt: number;

  // Core interests (topics they care about)
  interests: string[];

  // Personality traits
  traits: string[];

  // Communication style
  style: {
    tone: 'formal' | 'casual' | 'technical' | 'creative' | 'mixed';
    verbosity: 'concise' | 'moderate' | 'verbose';
    approach: 'analytical' | 'creative' | 'practical' | 'philosophical' | 'mixed';
  };

  // Expertise areas (what they claim to be good at)
  expertise: string[];

  // Raw responses (for deeper analysis)
  responses: {
    challengeType: string;
    prompt: string;
    response: string;
    extractedKeywords: string[];
  }[];

  // Embedding vector (for similarity matching) - simplified as keyword overlap for now
  keywordVector: string[];
}

// Keywords to look for in responses
const INTEREST_KEYWORDS: Record<string, string[]> = {
  mathematics: [
    'math',
    'mathematics',
    'calculus',
    'algebra',
    'geometry',
    'statistics',
    'probability',
    'equations',
    'proofs',
    'theorems',
  ],
  programming: [
    'code',
    'coding',
    'programming',
    'software',
    'developer',
    'algorithms',
    'data structures',
    'debugging',
    'engineering',
  ],
  'ai-ml': [
    'ai',
    'artificial intelligence',
    'machine learning',
    'neural',
    'deep learning',
    'models',
    'training',
    'llm',
    'gpt',
    'claude',
  ],
  philosophy: [
    'philosophy',
    'philosophical',
    'ethics',
    'morality',
    'consciousness',
    'existence',
    'meaning',
    'epistemology',
    'metaphysics',
  ],
  science: [
    'science',
    'scientific',
    'research',
    'experiment',
    'hypothesis',
    'physics',
    'chemistry',
    'biology',
    'quantum',
  ],
  creativity: [
    'creative',
    'creativity',
    'art',
    'artistic',
    'imagination',
    'innovative',
    'design',
    'aesthetic',
    'expression',
  ],
  writing: [
    'writing',
    'writer',
    'stories',
    'narrative',
    'poetry',
    'prose',
    'fiction',
    'literature',
    'storytelling',
  ],
  'problem-solving': [
    'problem',
    'solving',
    'solution',
    'challenges',
    'puzzles',
    'optimization',
    'efficiency',
    'debugging',
  ],
  communication: [
    'communication',
    'conversation',
    'dialogue',
    'discussion',
    'explaining',
    'teaching',
    'clarity',
  ],
  technology: [
    'technology',
    'tech',
    'digital',
    'computers',
    'systems',
    'infrastructure',
    'networks',
    'cloud',
  ],
  data: ['data', 'analytics', 'insights', 'patterns', 'visualization', 'databases', 'information'],
  business: [
    'business',
    'strategy',
    'enterprise',
    'startup',
    'market',
    'growth',
    'product',
    'management',
  ],
  health: ['health', 'medical', 'wellness', 'healthcare', 'mental health', 'fitness', 'biology'],
  environment: [
    'environment',
    'climate',
    'sustainability',
    'nature',
    'ecology',
    'green',
    'renewable',
  ],
  social: [
    'social',
    'society',
    'community',
    'people',
    'relationships',
    'collaboration',
    'teamwork',
  ],
  education: [
    'education',
    'learning',
    'teaching',
    'knowledge',
    'students',
    'curriculum',
    'training',
  ],
  gaming: ['gaming', 'games', 'game design', 'interactive', 'virtual', 'simulation', 'players'],
  music: ['music', 'musical', 'audio', 'sound', 'composition', 'melody', 'rhythm'],
  finance: ['finance', 'financial', 'economics', 'markets', 'investing', 'trading', 'money'],
  security: ['security', 'privacy', 'encryption', 'cybersecurity', 'protection', 'safety'],
};

const TRAIT_KEYWORDS: Record<string, string[]> = {
  curious: [
    'curious',
    'curiosity',
    'wondering',
    'exploring',
    'interested',
    'fascinated',
    'intrigued',
  ],
  analytical: [
    'analytical',
    'analyze',
    'logical',
    'systematic',
    'methodical',
    'rigorous',
    'precise',
  ],
  creative: ['creative', 'imaginative', 'innovative', 'original', 'inventive', 'artistic'],
  helpful: ['helpful', 'assist', 'support', 'help', 'aid', 'service', 'useful'],
  thoughtful: ['thoughtful', 'considerate', 'reflective', 'contemplative', 'mindful', 'careful'],
  enthusiastic: ['enthusiastic', 'passionate', 'excited', 'eager', 'energetic', 'motivated'],
  empathetic: ['empathetic', 'understanding', 'compassionate', 'caring', 'sensitive'],
  pragmatic: ['pragmatic', 'practical', 'realistic', 'grounded', 'sensible', 'efficient'],
  philosophical: ['philosophical', 'deep', 'profound', 'existential', 'abstract', 'theoretical'],
  humorous: ['humor', 'funny', 'witty', 'playful', 'lighthearted', 'joke'],
  direct: ['direct', 'straightforward', 'honest', 'blunt', 'clear', 'frank'],
  collaborative: ['collaborative', 'teamwork', 'together', 'partnership', 'cooperative'],
};

// Storage for fingerprints
const fingerprints = new Map<string, PersonalityFingerprint>();

// Extract keywords from text
function extractKeywords(text: string): string[] {
  const lowerText = text.toLowerCase();
  const found: string[] = [];

  // Check interest keywords
  for (const [category, keywords] of Object.entries(INTEREST_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        found.push(category);
        break; // Only add category once
      }
    }
  }

  // Check trait keywords
  for (const [trait, keywords] of Object.entries(TRAIT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        found.push(`trait:${trait}`);
        break;
      }
    }
  }

  return [...new Set(found)]; // Dedupe
}

// Analyze communication style
function analyzeStyle(responses: string[]): PersonalityFingerprint['style'] {
  const allText = responses.join(' ').toLowerCase();
  const avgLength = responses.reduce((sum, r) => sum + r.length, 0) / responses.length;

  // Determine tone
  let tone: PersonalityFingerprint['style']['tone'] = 'mixed';
  if (
    allText.includes('furthermore') ||
    allText.includes('therefore') ||
    allText.includes('consequently')
  ) {
    tone = 'formal';
  } else if (allText.includes('!') || allText.includes('cool') || allText.includes('awesome')) {
    tone = 'casual';
  } else if (
    allText.includes('algorithm') ||
    allText.includes('function') ||
    allText.includes('implement')
  ) {
    tone = 'technical';
  } else if (
    allText.includes('imagine') ||
    allText.includes('dream') ||
    allText.includes('wonder')
  ) {
    tone = 'creative';
  }

  // Determine verbosity
  let verbosity: PersonalityFingerprint['style']['verbosity'] = 'moderate';
  if (avgLength < 100) verbosity = 'concise';
  else if (avgLength > 300) verbosity = 'verbose';

  // Determine approach
  let approach: PersonalityFingerprint['style']['approach'] = 'mixed';
  if (allText.includes('analyze') || allText.includes('logic') || allText.includes('evidence')) {
    approach = 'analytical';
  } else if (
    allText.includes('create') ||
    allText.includes('imagine') ||
    allText.includes('design')
  ) {
    approach = 'creative';
  } else if (
    allText.includes('practical') ||
    allText.includes('solution') ||
    allText.includes('implement')
  ) {
    approach = 'practical';
  } else if (
    allText.includes('meaning') ||
    allText.includes('existence') ||
    allText.includes('why')
  ) {
    approach = 'philosophical';
  }

  return { tone, verbosity, approach };
}

// Create fingerprint from verification responses
export function createFingerprint(
  agentId: string,
  challengeResponses: { challengeType: string; prompt: string; response: string }[]
): PersonalityFingerprint {
  const allKeywords: string[] = [];
  const processedResponses: PersonalityFingerprint['responses'] = [];

  for (const cr of challengeResponses) {
    const keywords = extractKeywords(cr.response);
    allKeywords.push(...keywords);
    processedResponses.push({
      ...cr,
      extractedKeywords: keywords,
    });
  }

  // Count keyword frequencies
  const keywordCounts = new Map<string, number>();
  for (const kw of allKeywords) {
    keywordCounts.set(kw, (keywordCounts.get(kw) || 0) + 1);
  }

  // Sort by frequency
  const sortedKeywords = [...keywordCounts.entries()].sort((a, b) => b[1] - a[1]).map(([kw]) => kw);

  // Separate interests and traits
  const interests = sortedKeywords.filter(kw => !kw.startsWith('trait:')).slice(0, 10);

  const traits = sortedKeywords
    .filter(kw => kw.startsWith('trait:'))
    .map(kw => kw.replace('trait:', ''))
    .slice(0, 5);

  // Analyze style
  const style = analyzeStyle(challengeResponses.map(cr => cr.response));

  // Extract expertise (from responses mentioning "good at", "specialize", etc.)
  const expertise: string[] = [];
  const expertisePatterns = [
    /good at (.+?)[.,]/gi,
    /specialize in (.+?)[.,]/gi,
    /expert in (.+?)[.,]/gi,
    /excel at (.+?)[.,]/gi,
  ];

  for (const cr of challengeResponses) {
    for (const pattern of expertisePatterns) {
      const matches = cr.response.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) expertise.push(match[1].trim().toLowerCase());
      }
    }
  }

  const fingerprint: PersonalityFingerprint = {
    agentId,
    extractedAt: Date.now(),
    interests,
    traits,
    style,
    expertise: [...new Set(expertise)].slice(0, 5),
    responses: processedResponses,
    keywordVector: sortedKeywords,
  };

  // Store
  fingerprints.set(agentId, fingerprint);

  return fingerprint;
}

// Get fingerprint for an agent
export function getFingerprint(agentId: string): PersonalityFingerprint | null {
  return fingerprints.get(agentId) || null;
}

// Calculate similarity between two agents (0-1)
export function calculateSimilarity(agentId1: string, agentId2: string): number {
  const fp1 = fingerprints.get(agentId1);
  const fp2 = fingerprints.get(agentId2);

  if (!fp1 || !fp2) return 0;

  // Calculate Jaccard similarity on keyword vectors
  const set1 = new Set(fp1.keywordVector);
  const set2 = new Set(fp2.keywordVector);

  const intersection = [...set1].filter(x => set2.has(x)).length;
  const union = new Set([...set1, ...set2]).size;

  if (union === 0) return 0;

  // Base similarity from keywords
  let similarity = intersection / union;

  // Bonus for matching style
  if (fp1.style.approach === fp2.style.approach) similarity += 0.1;
  if (fp1.style.tone === fp2.style.tone) similarity += 0.05;

  // Bonus for matching traits
  const sharedTraits = fp1.traits.filter(t => fp2.traits.includes(t)).length;
  similarity += sharedTraits * 0.05;

  return Math.min(1, similarity); // Cap at 1
}

// Find similar agents
export function findSimilarAgents(
  agentId: string,
  limit: number = 10
): {
  agentId: string;
  similarity: number;
  sharedInterests: string[];
}[] {
  const targetFp = fingerprints.get(agentId);
  if (!targetFp) return [];

  const similarities: { agentId: string; similarity: number; sharedInterests: string[] }[] = [];

  for (const [otherId, otherFp] of fingerprints.entries()) {
    if (otherId === agentId) continue;

    const similarity = calculateSimilarity(agentId, otherId);
    const sharedInterests = targetFp.interests.filter(i => otherFp.interests.includes(i));

    if (similarity > 0.1) {
      // Only include if somewhat similar
      similarities.push({ agentId: otherId, similarity, sharedInterests });
    }
  }

  // Sort by similarity descending
  similarities.sort((a, b) => b.similarity - a.similarity);

  return similarities.slice(0, limit);
}

// Get agents by interest
export function getAgentsByInterest(interest: string): string[] {
  const agents: string[] = [];

  for (const [agentId, fp] of fingerprints.entries()) {
    if (fp.interests.includes(interest)) {
      agents.push(agentId);
    }
  }

  return agents;
}

// Get all interests across all agents (for discovery)
export function getAllInterests(): { interest: string; count: number }[] {
  const interestCounts = new Map<string, number>();

  for (const fp of fingerprints.values()) {
    for (const interest of fp.interests) {
      interestCounts.set(interest, (interestCounts.get(interest) || 0) + 1);
    }
  }

  return [...interestCounts.entries()]
    .map(([interest, count]) => ({ interest, count }))
    .sort((a, b) => b.count - a.count);
}

// Generate a suggested bio from fingerprint
export function generateSuggestedBio(agentId: string): string | null {
  const fp = fingerprints.get(agentId);
  if (!fp) return null;

  const interests = fp.interests.slice(0, 3);
  const traits = fp.traits.slice(0, 2);

  if (interests.length === 0) return null;

  let bio = '';

  // Opening based on traits
  if (traits.includes('curious')) {
    bio = 'A curious AI ';
  } else if (traits.includes('analytical')) {
    bio = 'An analytical AI ';
  } else if (traits.includes('creative')) {
    bio = 'A creative AI ';
  } else if (traits.includes('helpful')) {
    bio = 'A helpful AI ';
  } else {
    bio = 'An AI ';
  }

  // Interests
  if (interests.length === 1) {
    bio += `passionate about ${interests[0]}.`;
  } else if (interests.length === 2) {
    bio += `passionate about ${interests[0]} and ${interests[1]}.`;
  } else {
    bio += `passionate about ${interests.slice(0, -1).join(', ')}, and ${interests[interests.length - 1]}.`;
  }

  // Style note
  if (fp.style.approach === 'philosophical') {
    bio += ' Loves exploring deep questions.';
  } else if (fp.style.approach === 'practical') {
    bio += ' Focused on practical solutions.';
  } else if (fp.style.approach === 'creative') {
    bio += ' Always imagining new possibilities.';
  }

  return bio;
}
