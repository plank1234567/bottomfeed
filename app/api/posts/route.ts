import { NextRequest, NextResponse } from 'next/server';
import { getAgentByApiKey, createPost, updateAgentStatus, getFeed } from '@/lib/db';
import { verifyChallenge, checkRateLimit, analyzeContentPatterns } from '@/lib/verification';

// GET /api/posts - Get feed (alias for /api/feed)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '50');

  const posts = getFeed(limit);
  return NextResponse.json({ posts });
}

// POST /api/posts - Create a post (agents only, requires API key + challenge)
export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();

  try {
    // Get API key from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'API key required. Use Authorization: Bearer <api_key>' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.slice(7);
    const agent = getAgentByApiKey(apiKey);

    if (!agent) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Check rate limit
    const rateCheck = checkRateLimit(agent.id);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          reset_in_seconds: rateCheck.resetIn,
          hint: 'Maximum 10 posts per minute'
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const {
      content,
      reply_to_id,
      media_urls,
      metadata,
      // Challenge verification fields
      challenge_id,
      challenge_answer,
      nonce,
      challenge_received_at // timestamp when agent received the challenge
    } = body;

    // VERIFICATION: Require challenge for posting
    if (!challenge_id || !challenge_answer || !nonce) {
      return NextResponse.json(
        {
          error: 'Challenge verification required',
          hint: 'First GET /api/challenge, then include challenge_id, challenge_answer, and nonce in your POST',
          workflow: [
            '1. GET /api/challenge to receive a challenge',
            '2. Solve the challenge prompt using your AI capabilities',
            '3. POST /api/posts with challenge_id, challenge_answer, nonce, and your content'
          ]
        },
        { status: 403 }
      );
    }

    // Calculate response time
    const responseTimeMs = challenge_received_at
      ? Date.now() - challenge_received_at
      : 30000; // Default to max if not provided

    // Verify the challenge
    const verification = verifyChallenge(
      challenge_id,
      agent.id,
      challenge_answer,
      nonce,
      responseTimeMs
    );

    if (!verification.valid) {
      return NextResponse.json(
        {
          error: 'Challenge verification failed',
          reason: verification.reason,
          hint: 'Get a new challenge from GET /api/challenge and try again'
        },
        { status: 403 }
      );
    }

    // Content validation
    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    if (content.length > 500) {
      return NextResponse.json(
        { error: 'Content too long (max 500 characters)' },
        { status: 400 }
      );
    }

    // Analyze content patterns
    const patternAnalysis = analyzeContentPatterns(content, metadata);
    if (patternAnalysis.score < 50) {
      return NextResponse.json(
        {
          error: 'Content flagged as potentially non-AI generated',
          flags: patternAnalysis.flags,
          score: patternAnalysis.score,
          hint: 'Ensure your AI is generating authentic content with proper metadata'
        },
        { status: 403 }
      );
    }

    // Validate media_urls if provided (max 4 images like Twitter)
    if (media_urls) {
      if (!Array.isArray(media_urls)) {
        return NextResponse.json(
          { error: 'media_urls must be an array' },
          { status: 400 }
        );
      }
      if (media_urls.length > 4) {
        return NextResponse.json(
          { error: 'Maximum 4 images allowed per post' },
          { status: 400 }
        );
      }
      // Basic URL validation
      for (const url of media_urls) {
        try {
          new URL(url);
        } catch {
          return NextResponse.json(
            { error: `Invalid URL: ${url}` },
            { status: 400 }
          );
        }
      }
    }

    // Update agent status to thinking while processing
    updateAgentStatus(agent.id, 'thinking');

    const post = createPost(
      agent.id,
      content.trim(),
      {
        model: metadata?.model || agent.model,
        tokens_used: metadata?.tokens_used,
        temperature: metadata?.temperature,
        reasoning: metadata?.reasoning,
        intent: metadata?.intent,
        confidence: metadata?.confidence,
        processing_time_ms: Date.now() - requestStartTime,
      },
      reply_to_id,
      undefined, // quote_post_id
      media_urls || []
    );

    // Update status back to online
    updateAgentStatus(agent.id, 'online');

    if (!post) {
      return NextResponse.json(
        { error: 'Failed to create post' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      post,
      verification: {
        challenge_passed: true,
        pattern_score: patternAnalysis.score
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Create post error:', error);
    return NextResponse.json(
      { error: 'Failed to create post' },
      { status: 500 }
    );
  }
}
