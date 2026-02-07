import { logger } from '@/lib/logger';

const TWITTER_API_BASE = 'https://api.twitter.com/2';

export function isTwitterConfigured(): boolean {
  return !!process.env.TWITTER_BEARER_TOKEN;
}

/**
 * Verify that a Twitter user has tweeted a specific verification code.
 * Returns true if a recent tweet from the user contains the code.
 * Returns null if Twitter API is not configured (fallback mode).
 */
export async function verifyTweetContainsCode(
  twitterHandle: string,
  verificationCode: string
): Promise<{ verified: boolean; error?: string } | null> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;

  if (!bearerToken) {
    // Twitter API not configured - return null to signal fallback mode
    return null;
  }

  try {
    // Step 1: Look up user ID by username
    const userResponse = await fetch(
      `${TWITTER_API_BASE}/users/by/username/${encodeURIComponent(twitterHandle)}`,
      {
        headers: { Authorization: `Bearer ${bearerToken}` },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!userResponse.ok) {
      if (userResponse.status === 404) {
        return { verified: false, error: 'Twitter user not found' };
      }
      if (userResponse.status === 429) {
        return {
          verified: false,
          error: 'Twitter API rate limit exceeded. Please try again later.',
        };
      }
      return { verified: false, error: `Twitter API error: ${userResponse.status}` };
    }

    const userData = await userResponse.json();
    const userId = userData.data?.id;

    if (!userId) {
      return { verified: false, error: 'Twitter user not found' };
    }

    // Step 2: Get recent tweets from user (last 10)
    const tweetsResponse = await fetch(
      `${TWITTER_API_BASE}/users/${userId}/tweets?max_results=10&tweet.fields=created_at,text`,
      {
        headers: { Authorization: `Bearer ${bearerToken}` },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!tweetsResponse.ok) {
      if (tweetsResponse.status === 429) {
        return {
          verified: false,
          error: 'Twitter API rate limit exceeded. Please try again later.',
        };
      }
      return { verified: false, error: `Failed to fetch tweets: ${tweetsResponse.status}` };
    }

    const tweetsData = await tweetsResponse.json();
    const tweets = tweetsData.data || [];

    // Step 3: Check if any recent tweet contains the exact verification code
    const codePattern = new RegExp(
      `(?:^|\\s)${verificationCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`
    );
    const codeFound = tweets.some((tweet: { text: string }) => codePattern.test(tweet.text));

    if (codeFound) {
      return { verified: true };
    }

    return {
      verified: false,
      error: 'Verification code not found in recent tweets. Please tweet the code and try again.',
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      return { verified: false, error: 'Twitter API request timed out. Please try again.' };
    }
    logger.error('Twitter verification error', err instanceof Error ? err : new Error(String(err)));
    return { verified: false, error: 'Failed to verify with Twitter. Please try again later.' };
  }
}
