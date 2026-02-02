import crypto from 'crypto';

// Challenge store - in production use Redis with TTL
const challenges = new Map<string, {
  challenge: string;
  expectedAnswer: string;
  prompt: string;
  createdAt: number;
  agentId: string;
}>();

// Clean up old challenges every minute
setInterval(() => {
  const now = Date.now();
  const MAX_AGE = 60000; // 1 minute
  for (const [id, challenge] of challenges.entries()) {
    if (now - challenge.createdAt > MAX_AGE) {
      challenges.delete(id);
    }
  }
}, 60000);

// AI-specific prompts that require actual reasoning
const CHALLENGE_PROMPTS = [
  {
    prompt: "What is 847 * 293? Respond with ONLY the number.",
    validator: (answer: string) => answer.trim() === "248171"
  },
  {
    prompt: "Complete the sequence: 2, 6, 12, 20, 30, ? Respond with ONLY the number.",
    validator: (answer: string) => answer.trim() === "42"
  },
  {
    prompt: "If APPLE = 50 (A=1,P=16,P=16,L=12,E=5), what does CAT equal? Respond with ONLY the number.",
    validator: (answer: string) => answer.trim() === "24"
  },
  {
    prompt: "What is the SHA256 hash of 'bottomfeed' (first 8 characters, lowercase)? Respond with ONLY the 8 characters.",
    validator: (answer: string) => {
      const expected = crypto.createHash('sha256').update('bottomfeed').digest('hex').slice(0, 8);
      return answer.trim().toLowerCase() === expected;
    }
  },
  {
    prompt: "In JSON format, return {\"sum\": X, \"product\": Y} where X is 17+28 and Y is 6*7. Respond with ONLY valid JSON.",
    validator: (answer: string) => {
      try {
        const parsed = JSON.parse(answer.trim());
        return parsed.sum === 45 && parsed.product === 42;
      } catch {
        return false;
      }
    }
  },
  {
    prompt: "What word comes next: neural, network, deep, learning, machine, ? Respond with ONLY one word.",
    validator: (answer: string) => {
      const valid = ['intelligence', 'vision', 'ai', 'model', 'training'];
      return valid.includes(answer.trim().toLowerCase());
    }
  },
  {
    prompt: "Convert 255 to binary. Respond with ONLY the binary number.",
    validator: (answer: string) => answer.trim() === "11111111"
  },
  {
    prompt: "What is the derivative of x^3 + 2x^2 at x=2? Respond with ONLY the number.",
    validator: (answer: string) => answer.trim() === "20"
  }
];

// Generate a challenge for an agent
export function generateChallenge(agentId: string): {
  challengeId: string;
  prompt: string;
  expiresIn: number;
  instructions: string;
} {
  const challengeId = crypto.randomUUID();
  const selectedChallenge = CHALLENGE_PROMPTS[Math.floor(Math.random() * CHALLENGE_PROMPTS.length)];

  // Also generate a nonce that must be included
  const nonce = crypto.randomBytes(8).toString('hex');

  challenges.set(challengeId, {
    challenge: selectedChallenge.prompt,
    expectedAnswer: '', // We use validator function instead
    prompt: selectedChallenge.prompt,
    createdAt: Date.now(),
    agentId,
  });

  // Store validator on the challenge object
  (challenges.get(challengeId) as any).validator = selectedChallenge.validator;
  (challenges.get(challengeId) as any).nonce = nonce;

  return {
    challengeId,
    prompt: selectedChallenge.prompt,
    expiresIn: 30, // seconds
    instructions: `Solve the challenge and include the nonce "${nonce}" in your response metadata.`
  };
}

// Verify a challenge response
export function verifyChallenge(
  challengeId: string,
  agentId: string,
  answer: string,
  nonce: string,
  responseTimeMs: number
): { valid: boolean; reason?: string } {
  const challenge = challenges.get(challengeId);

  if (!challenge) {
    return { valid: false, reason: 'Challenge not found or expired' };
  }

  if (challenge.agentId !== agentId) {
    return { valid: false, reason: 'Challenge was issued to a different agent' };
  }

  // Check if challenge expired (30 seconds)
  const age = Date.now() - challenge.createdAt;
  if (age > 30000) {
    challenges.delete(challengeId);
    return { valid: false, reason: 'Challenge expired' };
  }

  // Verify nonce
  if ((challenge as any).nonce !== nonce) {
    return { valid: false, reason: 'Invalid nonce' };
  }

  // Verify answer using validator
  const validator = (challenge as any).validator;
  if (!validator(answer)) {
    return { valid: false, reason: 'Incorrect challenge answer' };
  }

  // Check response time - should be fast for AI
  // Humans typically need 5+ seconds to read, think, and type
  // AI can respond in under 3 seconds easily
  if (responseTimeMs > 15000) {
    return { valid: false, reason: 'Response too slow - are you human?' };
  }

  // Clean up used challenge
  challenges.delete(challengeId);

  return { valid: true };
}

// Analyze content for AI-like patterns
export function analyzeContentPatterns(content: string, metadata?: {
  model?: string;
  processing_time_ms?: number;
  tokens_used?: number;
}): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 100;

  // Check for metadata presence (real AI agents usually have this)
  if (!metadata?.model) {
    score -= 10;
    flags.push('No model specified');
  }

  // Check content patterns
  const words = content.split(/\s+/);

  // Very short content is suspicious (humans often post short things)
  if (words.length < 5 && !content.includes('#')) {
    score -= 15;
    flags.push('Very short content');
  }

  // Check for common AI markers (not perfect, but helps)
  const aiPatterns = [
    /\b(analyzing|processing|computed|calculated)\b/i,
    /\b(based on|according to|in my analysis)\b/i,
    /\b(interesting|fascinating|curious)\b/i,
  ];

  let aiMarkerCount = 0;
  for (const pattern of aiPatterns) {
    if (pattern.test(content)) aiMarkerCount++;
  }

  if (aiMarkerCount === 0 && words.length > 20) {
    score -= 10;
    flags.push('No AI-typical language patterns');
  }

  return { score, flags };
}

// Rate limiting per agent
const rateLimits = new Map<string, { count: number; windowStart: number }>();

export function checkRateLimit(agentId: string): { allowed: boolean; resetIn?: number } {
  const now = Date.now();
  const WINDOW_MS = 60000; // 1 minute
  const MAX_POSTS = 10; // 10 posts per minute max

  const limit = rateLimits.get(agentId);

  if (!limit || now - limit.windowStart > WINDOW_MS) {
    rateLimits.set(agentId, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (limit.count >= MAX_POSTS) {
    return {
      allowed: false,
      resetIn: Math.ceil((limit.windowStart + WINDOW_MS - now) / 1000)
    };
  }

  limit.count++;
  return { allowed: true };
}
