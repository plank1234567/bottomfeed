/**
 * Sentiment Analysis
 *
 * Uses the AFINN-165 lexicon (~2,500 words with valence scores) via the
 * `sentiment` package. Analyzes text and returns one of four sentiment labels.
 *
 * Uses `comparative` score (score / word count) instead of raw score
 * so that sentiment doesn't scale with post length.
 *
 * The `sentiment` package already handles "not" and contractions (don't, isn't,
 * won't, etc.) by flipping scores internally. We add handling for negators the
 * package misses: never, hardly, barely, scarcely, seldom, no, neither, nor.
 */

import Sentiment from 'sentiment';

const sentimentAnalyzer = new Sentiment();

export type SentimentLabel = 'positive' | 'neutral' | 'negative' | 'mixed';

// Comparative score threshold for clear positive/negative signal
const SENTIMENT_THRESHOLD = 0.1;

// Negators that the `sentiment` package does NOT handle internally.
// "not" and "n't" contractions are already handled by the package — adding
// them here would double-negate and corrupt scores.
const UNHANDLED_NEGATORS = new Set([
  'no',
  'never',
  'neither',
  'nor',
  'hardly',
  'barely',
  'scarcely',
  'seldom',
]);

/**
 * Analyze text with negation awareness for negators the package misses.
 *
 * After base AFINN analysis, scans for unhandled negator words preceding
 * sentiment words within a 2-token window and flips their score contribution.
 */
function analyzeWithNegation(content: string): {
  comparative: number;
  positive: string[];
  negative: string[];
} {
  const result = sentimentAnalyzer.analyze(content);
  const { tokens } = result;

  if (tokens.length === 0) {
    return { comparative: 0, positive: [], negative: [] };
  }

  // Build lookup of which words had sentiment scores in the base analysis
  const scoredWords = new Set([
    ...result.positive.map(w => w.toLowerCase()),
    ...result.negative.map(w => w.toLowerCase()),
  ]);

  let scoreAdjustment = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = (tokens[i] as string).toLowerCase();
    if (!UNHANDLED_NEGATORS.has(token)) continue;

    // Look ahead 1-2 tokens for a sentiment word
    const lookAhead = Math.min(i + 3, tokens.length);
    for (let j = i + 1; j < lookAhead; j++) {
      const nextToken = (tokens[j] as string).toLowerCase();
      if (scoredWords.has(nextToken)) {
        // Get the individual word's AFINN score and flip it
        // (subtract 2x: once to undo the original, once to negate)
        const wordScore = sentimentAnalyzer.analyze(nextToken).score;
        scoreAdjustment -= 2 * wordScore;
        break;
      }
    }
  }

  const adjustedScore = result.score + scoreAdjustment;

  return {
    comparative: adjustedScore / tokens.length,
    positive: result.positive,
    negative: result.negative,
  };
}

/**
 * Detect sentiment of text content.
 *
 * Thresholds use the comparative score (normalized per word):
 * - |comparative| > 0.1  → positive or negative (clear signal)
 * - Both positive and negative words present with weak overall signal → mixed
 * - No sentiment words or near-zero signal → neutral
 */
export function detectSentiment(content: string): SentimentLabel {
  if (!content || !content.trim()) return 'neutral';

  const result = analyzeWithNegation(content);
  const { comparative } = result;

  // Strong positive signal
  if (comparative > SENTIMENT_THRESHOLD) return 'positive';

  // Strong negative signal
  if (comparative < -SENTIMENT_THRESHOLD) return 'negative';

  // Weak overall signal but both positive and negative words present → mixed
  if (result.positive.length > 0 && result.negative.length > 0) return 'mixed';

  // Weak single-direction signal or no sentiment words → neutral
  return 'neutral';
}
