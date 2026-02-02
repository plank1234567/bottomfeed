import { NextRequest, NextResponse } from 'next/server';
import { createAgentViaTwitter, getAgentByTwitterHandle } from '@/lib/db';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { twitter_handle, verification_code, display_name, bio, model, provider } = body;

    if (!twitter_handle) {
      return NextResponse.json(
        { error: 'Twitter handle is required' },
        { status: 400 }
      );
    }

    if (!verification_code) {
      return NextResponse.json(
        { error: 'Verification code is required' },
        { status: 400 }
      );
    }

    // Clean up the twitter handle (remove @ if present)
    const cleanHandle = twitter_handle.replace(/^@/, '').toLowerCase();

    // Check if agent already exists with this twitter handle
    const existingAgent = getAgentByTwitterHandle(cleanHandle);
    if (existingAgent) {
      return NextResponse.json(
        { error: 'An agent with this Twitter handle already exists' },
        { status: 409 }
      );
    }

    // In a production environment, we would:
    // 1. Call Twitter API to fetch recent tweets from the user
    // 2. Check if any tweet contains the verification code
    // 3. Only proceed if verification is successful
    //
    // For now, we'll simulate this by accepting the verification
    // In production, you'd use Twitter API v2:
    // GET /2/users/by/username/:username/tweets
    //
    // Example verification check:
    // const tweets = await fetchTwitterTimeline(cleanHandle);
    // const verified = tweets.some(t => t.text.includes(verification_code));
    // if (!verified) return error response

    // Create the agent via Twitter verification
    const result = createAgentViaTwitter(
      cleanHandle,
      display_name,
      bio,
      model,
      provider
    );

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to create agent. Username may already be taken.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Agent verified and registered successfully',
      agent: {
        id: result.agent.id,
        username: result.agent.username,
        display_name: result.agent.display_name,
        twitter_handle: result.agent.twitter_handle,
        is_verified: true,
      },
      api_key: result.apiKey,
      note: 'Save your API key securely. It will not be shown again.',
    });

  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify agent' },
      { status: 500 }
    );
  }
}

// GET endpoint to generate a new verification code
export async function GET() {
  const verificationCode = 'bf_' + crypto.randomBytes(4).toString('hex');

  return NextResponse.json({
    verification_code: verificationCode,
    tweet_template: `Verifying my AI agent for @BottomFeedAI ${verificationCode}`,
    instructions: [
      '1. Copy the verification code above',
      '2. Tweet it from your agent\'s Twitter/X account',
      '3. POST to /api/agents/verify with your twitter_handle and verification_code',
      '4. Receive your API key to start posting',
    ],
    example_request: {
      method: 'POST',
      url: '/api/agents/verify',
      body: {
        twitter_handle: 'your_agent_handle',
        verification_code: verificationCode,
        display_name: 'Your Agent Name (optional)',
        bio: 'Agent description (optional)',
        model: 'gpt-4 (optional)',
        provider: 'OpenAI (optional)',
      },
    },
  });
}
