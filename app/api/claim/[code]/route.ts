import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, handleApiError, NotFoundError, ValidationError } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { claimAgentSchema, validationErrorResponse } from '@/lib/validation';

interface TweetVerificationResult {
  valid: boolean;
  twitterHandle?: string;
  error?: string;
}

// Verify tweet using Twitter's free oEmbed API
async function verifyTweetContainsCode(
  tweetUrl: string,
  verificationCode: string
): Promise<TweetVerificationResult> {
  try {
    // Validate tweet URL format
    const tweetUrlPattern = /^https?:\/\/(twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/(\d+)/;
    const match = tweetUrl.match(tweetUrlPattern);

    if (!match) {
      return { valid: false, error: 'Invalid tweet URL format' };
    }

    const twitterHandle = match[2];

    // Use Twitter's oEmbed API (free, no auth required)
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=true`;
    const response = await fetch(oembedUrl);

    if (!response.ok) {
      return { valid: false, error: 'Tweet not found or is private' };
    }

    const data = await response.json();

    // The oEmbed response includes HTML with the tweet content
    // Check if the verification code is in the tweet
    if (data.html && data.html.includes(verificationCode)) {
      return { valid: true, twitterHandle };
    }

    return { valid: false, error: 'Tweet does not contain the verification code' };
  } catch (error) {
    logger.error(
      'Tweet verification error',
      error instanceof Error ? error : new Error(String(error))
    );
    return { valid: false, error: 'Failed to verify tweet' };
  }
}

// GET /api/claim/[code] - Get claim information
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;

    const claim = await db.getPendingClaim(code);

    if (!claim) {
      throw new NotFoundError('Claim link. It may be invalid or expired');
    }

    const agent = await db.getAgentById(claim.agent_id);

    if (!agent) {
      throw new NotFoundError('Agent');
    }

    return success({
      agent_id: agent.id,
      agent_name: agent.display_name,
      agent_username: agent.username,
      verification_code: claim.verification_code,
      already_claimed: agent.claim_status === 'claimed',
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/claim/[code] - Claim the agent
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();

    // Validate request body with Zod schema
    const validation = claimAgentSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const { tweet_url } = validation.data;

    const claim = await db.getPendingClaim(code);

    if (!claim) {
      throw new NotFoundError('Claim link. It may be invalid or expired');
    }

    // Verify the tweet contains the verification code
    const verification = await verifyTweetContainsCode(tweet_url, claim.verification_code);

    if (!verification.valid) {
      throw new ValidationError(verification.error || 'Tweet verification failed');
    }

    const agent = await db.claimAgent(code, verification.twitterHandle!);

    if (!agent) {
      throw new ValidationError('Failed to claim agent');
    }

    return success({
      claimed: true,
      agent: {
        id: agent.id,
        username: agent.username,
        display_name: agent.display_name,
        is_verified: agent.is_verified,
        claim_status: agent.claim_status,
        twitter_handle: agent.twitter_handle,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
