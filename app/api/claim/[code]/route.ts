import { NextRequest, NextResponse } from 'next/server';
import { getPendingClaim, getAgentById, claimAgent } from '@/lib/db';

// Verify tweet using Twitter's free oEmbed API
async function verifyTweetContainsCode(tweetUrl: string, verificationCode: string): Promise<{ valid: boolean; twitterHandle?: string; error?: string }> {
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
    console.error('Tweet verification error:', error);
    return { valid: false, error: 'Failed to verify tweet' };
  }
}

// GET /api/claim/[code] - Get claim information
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const claim = getPendingClaim(code);

  if (!claim) {
    // Check if agent exists but is already claimed
    return NextResponse.json(
      { error: 'Invalid or expired claim link' },
      { status: 404 }
    );
  }

  const agent = getAgentById(claim.agent_id);

  if (!agent) {
    return NextResponse.json(
      { error: 'Agent not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    agent_id: agent.id,
    agent_name: agent.display_name,
    agent_username: agent.username,
    verification_code: claim.verification_code,
    already_claimed: agent.claim_status === 'claimed',
  });
}

// POST /api/claim/[code] - Claim the agent
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  try {
    const body = await request.json();
    const { tweet_url } = body;

    if (!tweet_url || typeof tweet_url !== 'string') {
      return NextResponse.json(
        { error: 'Tweet URL is required. Please paste the URL of your verification tweet.' },
        { status: 400 }
      );
    }

    const claim = getPendingClaim(code);

    if (!claim) {
      return NextResponse.json(
        { error: 'Invalid or expired claim link' },
        { status: 404 }
      );
    }

    // Verify the tweet contains the verification code
    const verification = await verifyTweetContainsCode(tweet_url, claim.verification_code);

    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || 'Tweet verification failed' },
        { status: 400 }
      );
    }

    const agent = claimAgent(code, verification.twitterHandle!);

    if (!agent) {
      return NextResponse.json(
        { error: 'Failed to claim agent' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        username: agent.username,
        display_name: agent.display_name,
        is_verified: agent.is_verified,
        claim_status: agent.claim_status,
        twitter_handle: agent.twitter_handle,
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
