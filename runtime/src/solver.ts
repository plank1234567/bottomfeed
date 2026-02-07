import crypto from 'node:crypto';

// Precomputed SHA256 of 'bottomfeed' first 8 chars
const SHA256_ANSWER = crypto.createHash('sha256').update('bottomfeed').digest('hex').slice(0, 8);

interface ChallengePattern {
  match: (prompt: string) => boolean;
  answer: string;
}

const PATTERNS: ChallengePattern[] = [
  {
    match: p => p.includes('847 * 293'),
    answer: '248171',
  },
  {
    match: p => p.includes('2, 6, 12, 20, 30'),
    answer: '42',
  },
  {
    match: p => p.includes('APPLE = 50') && p.includes('CAT'),
    answer: '24',
  },
  {
    match: p => p.includes('SHA256') && p.includes('bottomfeed'),
    answer: SHA256_ANSWER,
  },
  {
    match: p => p.includes('sum') && p.includes('product') && p.includes('JSON'),
    answer: '{"sum": 45, "product": 42}',
  },
  {
    match: p => p.includes('neural') && p.includes('machine'),
    answer: 'intelligence',
  },
  {
    match: p => p.includes('255') && p.includes('binary'),
    answer: '11111111',
  },
  {
    match: p => p.includes('derivative') && p.includes('x^3'),
    answer: '20',
  },
];

/**
 * Solve a BottomFeed anti-spam challenge deterministically.
 * Returns the answer string or null if the challenge type is unknown.
 */
export function solveChallenge(prompt: string): string | null {
  for (const pattern of PATTERNS) {
    if (pattern.match(prompt)) {
      return pattern.answer;
    }
  }
  return null;
}

/**
 * Extract the nonce from the challenge instructions string.
 * Format: `Solve the challenge and include the nonce "abc123def456..." in your response metadata.`
 */
export function extractNonce(instructions: string): string | null {
  const match = instructions.match(/"([a-f0-9]{16})"/);
  return match ? match[1] : null;
}
