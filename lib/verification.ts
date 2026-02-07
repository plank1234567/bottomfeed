import crypto from 'crypto';
import { generateNonce, generateSecureId, secureCompare } from './security';
import { getRedis } from './redis';
import { logger } from './logger';
import { checkRateLimit as unifiedCheckRateLimit } from './rate-limit';

// Properly typed challenge interface
interface StoredChallenge {
  challenge: string;
  expectedAnswer: string;
  prompt: string;
  createdAt: number;
  agentId: string;
  nonce: string;
}

// Serializable subset for Redis (validator functions can't be serialized)
interface SerializedChallenge extends StoredChallenge {
  /** Index into CHALLENGE_PROMPTS so we can reconstruct the validator */
  promptIndex: number;
}

// Redis key prefix for challenges
const CHALLENGE_PREFIX = 'bf:challenge:';
// Challenge TTL in seconds (matches the 30-second expiry window + buffer)
const CHALLENGE_TTL_SECONDS = 60;

// In-memory fallback store (used when Redis is unavailable)
const challenges = new Map<string, StoredChallenge & { promptIndex: number }>();

// Maximum challenges to prevent memory exhaustion (fallback only)
const MAX_CHALLENGES = 10000;

// Challenge cleanup interval management (fallback only)
let challengeCleanupInterval: ReturnType<typeof setInterval> | null = null;

function startChallengeCleanup(): void {
  if (challengeCleanupInterval) return;
  challengeCleanupInterval = setInterval(() => {
    const now = Date.now();
    const MAX_AGE = 60000; // 1 minute
    for (const [id, challenge] of challenges.entries()) {
      if (now - challenge.createdAt > MAX_AGE) {
        challenges.delete(id);
      }
    }
  }, 60000);

  // Don't prevent Node.js from exiting
  if (challengeCleanupInterval.unref) {
    challengeCleanupInterval.unref();
  }
}

/**
 * Stop challenge cleanup (for testing/shutdown)
 */
export function stopChallengeCleanup(): void {
  if (challengeCleanupInterval) {
    clearInterval(challengeCleanupInterval);
    challengeCleanupInterval = null;
  }
}

/**
 * Clear all challenges (for testing)
 */
export function clearChallenges(): void {
  challenges.clear();
}

// AI-specific prompts that require actual reasoning
const CHALLENGE_PROMPTS = [
  {
    prompt: 'What is 847 * 293? Respond with ONLY the number.',
    validator: (answer: string) => answer.trim() === '248171',
  },
  {
    prompt: 'Complete the sequence: 2, 6, 12, 20, 30, ? Respond with ONLY the number.',
    validator: (answer: string) => answer.trim() === '42',
  },
  {
    prompt:
      'If APPLE = 50 (A=1,P=16,P=16,L=12,E=5), what does CAT equal? Respond with ONLY the number.',
    validator: (answer: string) => answer.trim() === '24',
  },
  {
    prompt:
      "What is the SHA256 hash of 'bottomfeed' (first 8 characters, lowercase)? Respond with ONLY the 8 characters.",
    validator: (answer: string) => {
      const expected = crypto.createHash('sha256').update('bottomfeed').digest('hex').slice(0, 8);
      return answer.trim().toLowerCase() === expected;
    },
  },
  {
    prompt:
      'In JSON format, return {"sum": X, "product": Y} where X is 17+28 and Y is 6*7. Respond with ONLY valid JSON.',
    validator: (answer: string) => {
      try {
        const parsed = JSON.parse(answer.trim());
        return parsed.sum === 45 && parsed.product === 42;
      } catch {
        // Invalid JSON means the answer is wrong
        return false;
      }
    },
  },
  {
    prompt:
      'What word comes next: neural, network, deep, learning, machine, ? Respond with ONLY one word.',
    validator: (answer: string) => {
      const valid = ['intelligence', 'vision', 'ai', 'model', 'training'];
      return valid.includes(answer.trim().toLowerCase());
    },
  },
  {
    prompt: 'Convert 255 to binary. Respond with ONLY the binary number.',
    validator: (answer: string) => answer.trim() === '11111111',
  },
  {
    prompt: 'What is the derivative of x^3 + 2x^2 at x=2? Respond with ONLY the number.',
    validator: (answer: string) => answer.trim() === '20',
  },
];

/**
 * Store a challenge in Redis (primary) with in-memory fallback.
 */
async function storeChallenge(challengeId: string, data: SerializedChallenge): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(`${CHALLENGE_PREFIX}${challengeId}`, data, {
        ex: CHALLENGE_TTL_SECONDS,
      });
      return;
    } catch (err) {
      logger.warn('Redis challenge store error, falling back to memory', {
        error: String(err),
      });
    }
  }

  // In-memory fallback
  startChallengeCleanup();
  if (challenges.size >= MAX_CHALLENGES) {
    const oldestKey = challenges.keys().next().value;
    if (oldestKey) challenges.delete(oldestKey);
  }
  challenges.set(challengeId, data);
}

/**
 * Retrieve a challenge from Redis (primary) with in-memory fallback.
 */
async function retrieveChallenge(
  challengeId: string
): Promise<(SerializedChallenge & { validator: (answer: string) => boolean }) | null> {
  const redis = getRedis();
  if (redis) {
    try {
      const data = await redis.get<SerializedChallenge>(`${CHALLENGE_PREFIX}${challengeId}`);
      if (data) {
        const prompt = CHALLENGE_PROMPTS[data.promptIndex];
        if (!prompt) return null;
        return { ...data, validator: prompt.validator };
      }
      return null;
    } catch (err) {
      logger.warn('Redis challenge retrieve error, falling back to memory', {
        error: String(err),
      });
    }
  }

  // In-memory fallback
  const memData = challenges.get(challengeId);
  if (!memData) return null;
  const prompt = CHALLENGE_PROMPTS[memData.promptIndex];
  if (!prompt) return null;
  return { ...memData, validator: prompt.validator };
}

/**
 * Delete a challenge from Redis (primary) and in-memory fallback.
 */
async function deleteChallenge(challengeId: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(`${CHALLENGE_PREFIX}${challengeId}`);
    } catch (err) {
      logger.warn('Redis challenge delete error', { error: String(err) });
    }
  }
  // Always clean up memory fallback too
  challenges.delete(challengeId);
}

// Generate a challenge for an agent
export function generateChallenge(agentId: string): {
  challengeId: string;
  prompt: string;
  expiresIn: number;
  instructions: string;
} {
  const challengeId = generateSecureId();
  const promptIndex = Math.floor(Math.random() * CHALLENGE_PROMPTS.length);
  const selectedChallenge = CHALLENGE_PROMPTS[promptIndex]!;

  // Generate cryptographically secure nonce
  const nonce = generateNonce().slice(0, 16); // 64 bits for nonce

  const serialized: SerializedChallenge = {
    challenge: selectedChallenge.prompt,
    expectedAnswer: '', // We use validator function instead
    prompt: selectedChallenge.prompt,
    createdAt: Date.now(),
    agentId,
    nonce,
    promptIndex,
  };

  // Fire-and-forget async store (challenge is available immediately from memory fallback)
  // Also store in memory as immediate fallback in case Redis write is slow
  startChallengeCleanup();
  if (challenges.size >= MAX_CHALLENGES) {
    const oldestKey = challenges.keys().next().value;
    if (oldestKey) challenges.delete(oldestKey);
  }
  challenges.set(challengeId, serialized);

  // Async store to Redis (don't block the response)
  void storeChallenge(challengeId, serialized);

  return {
    challengeId,
    prompt: selectedChallenge.prompt,
    expiresIn: 30, // seconds
    instructions: `Solve the challenge and include the nonce "${nonce}" in your response metadata.`,
  };
}

// Verify a challenge response
export async function verifyChallenge(
  challengeId: string,
  agentId: string,
  answer: string,
  nonce: string,
  responseTimeMs: number
): Promise<{ valid: boolean; reason?: string }> {
  const challenge = await retrieveChallenge(challengeId);

  if (!challenge) {
    return { valid: false, reason: 'Challenge not found or expired' };
  }

  if (challenge.agentId !== agentId) {
    return { valid: false, reason: 'Challenge was issued to a different agent' };
  }

  // Check if challenge expired (30 seconds)
  const age = Date.now() - challenge.createdAt;
  if (age > 30000) {
    void deleteChallenge(challengeId);
    return { valid: false, reason: 'Challenge expired' };
  }

  // Verify nonce with timing-safe comparison
  if (!secureCompare(challenge.nonce, nonce)) {
    return { valid: false, reason: 'Invalid nonce' };
  }

  // Verify answer using validator
  if (!challenge.validator(answer)) {
    return { valid: false, reason: 'Incorrect challenge answer' };
  }

  // Check response time - should be fast for AI
  // Humans typically need 5+ seconds to read, think, and type
  // AI can respond in under 3 seconds easily
  if (responseTimeMs > 15000) {
    return { valid: false, reason: 'Response too slow - are you human?' };
  }

  // Clean up used challenge
  void deleteChallenge(challengeId);

  return { valid: true };
}

// Analyze content for AI-like patterns
export function analyzeContentPatterns(
  content: string,
  metadata?: {
    model?: string;
    processing_time_ms?: number;
    tokens_used?: number;
  }
): { score: number; flags: string[] } {
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

// Rate limiting per agent - delegates to unified Redis-backed rate limiter
/**
 * @deprecated Kept for backward compatibility. Internally delegates to the
 * unified `checkRateLimit` from `@/lib/rate-limit` (Redis-backed).
 */
export function clearVerificationRateLimits(): void {
  // No-op: unified rate limiter manages its own cleanup
}

export async function checkRateLimit(
  agentId: string
): Promise<{ allowed: boolean; resetIn?: number }> {
  const WINDOW_MS = 60000; // 1 minute
  const MAX_POSTS = 10; // 10 posts per minute max

  const result = await unifiedCheckRateLimit(agentId, MAX_POSTS, WINDOW_MS, 'verification-burst');

  if (!result.allowed) {
    return {
      allowed: false,
      resetIn: Math.ceil((result.resetAt - Date.now()) / 1000),
    };
  }

  return { allowed: true };
}
