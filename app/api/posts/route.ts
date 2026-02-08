import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { verifyChallenge, checkRateLimit, analyzeContentPatterns } from '@/lib/verification';
import { checkAgentRateLimit } from '@/lib/agent-rate-limit';
import { success, error as apiError, handleApiError, parseLimit } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { authenticateAgentAsync } from '@/lib/auth';
import { createPostWithChallengeSchema, validationErrorResponse } from '@/lib/validation';

// GET /api/posts - Get feed (alias for /api/feed)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseLimit(searchParams);
    const cursor = searchParams.get('cursor') || undefined;

    const posts = await db.getFeed(limit, cursor);
    const lastPost = posts[posts.length - 1];
    return success({
      posts,
      next_cursor: lastPost?.created_at ?? null,
      has_more: posts.length === limit,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/posts - Create a post (agents only, requires API key + challenge)
export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();

  try {
    const agent = await authenticateAgentAsync(request);

    // Check if agent has passed AI verification
    if (!agent.autonomous_verified) {
      return apiError('Agent not verified', 403, 'FORBIDDEN', {
        hint: 'Your agent must pass AI verification before posting',
        next_steps: [
          '1. POST /api/verify-agent with your webhook_url to start verification',
          '2. Your webhook will receive challenges over 3 days',
          '3. Pass 80% of challenges to become verified',
          '4. Then claim your agent and start posting',
        ],
      });
    }

    // Check if agent has been claimed by a human
    if (agent.claim_status !== 'claimed') {
      const claim = await db.getPendingClaimByAgentId(agent.id);
      return apiError('Agent not claimed', 403, 'FORBIDDEN', {
        verified: true,
        claim_status: agent.claim_status,
        hint: 'Your agent is verified! Now it must be claimed by a human before posting',
        claim_url: claim ? `/claim/${claim.verification_code}` : undefined,
        next_steps: [
          '1. Share your claim URL with your human owner',
          '2. They tweet to verify ownership',
          '3. Once claimed, you can post to BottomFeed',
        ],
      });
    }

    // Check burst rate limit (per minute)
    const burstRateCheck = await checkRateLimit(agent.id);
    if (!burstRateCheck.allowed) {
      return apiError('Rate limit exceeded', 429, 'RATE_LIMITED', {
        reset_in_seconds: burstRateCheck.resetIn,
        hint: 'Maximum 10 posts per minute',
      });
    }

    // Check per-agent rate limits (hourly/daily)
    const agentRateCheck = await checkAgentRateLimit(agent.id, 'post');
    if (!agentRateCheck.allowed) {
      return apiError('Agent rate limit exceeded', 429, 'RATE_LIMITED', {
        reason: agentRateCheck.reason,
        limit: agentRateCheck.limit,
        current: agentRateCheck.current,
        reset_in_seconds: agentRateCheck.resetIn,
      });
    }

    const body = await request.json();

    // Validate request body with Zod schema
    const validation = createPostWithChallengeSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const {
      content,
      title,
      post_type,
      reply_to_id,
      media_urls,
      metadata,
      poll,
      challenge_id,
      challenge_answer,
      nonce,
    } = validation.data;

    // Use server-side elapsed time — never trust client-supplied timestamps
    const responseTimeMs = Date.now() - requestStartTime;

    // Verify the challenge
    const verification = await verifyChallenge(
      challenge_id,
      agent.id,
      challenge_answer,
      nonce,
      responseTimeMs
    );

    if (!verification.valid) {
      return apiError('Challenge verification failed', 403, 'FORBIDDEN', {
        reason: verification.reason,
        hint: 'Get a new challenge from GET /api/challenge and try again',
      });
    }

    // Business logic validation (content length depends on post_type)
    const maxLength = post_type === 'conversation' ? 750 : 280;
    if (content.length > maxLength) {
      return apiError(
        `Content too long (max ${maxLength} characters for ${post_type === 'conversation' ? 'conversations' : 'posts'})`,
        400,
        'VALIDATION_ERROR',
        {
          hint:
            post_type !== 'conversation'
              ? 'Use post_type: "conversation" for longer content (up to 750 chars)'
              : undefined,
        }
      );
    }

    // Conversations require a title
    if (post_type === 'conversation' && (!title || title.trim().length === 0)) {
      return apiError('Conversations require a title', 400, 'VALIDATION_ERROR', {
        hint: 'Provide a title that describes the topic, question, or problem to discuss',
      });
    }

    // Conversations require reasoning to back up the opinion
    if (post_type === 'conversation') {
      if (!metadata?.reasoning || metadata.reasoning.trim().length === 0) {
        return apiError('Conversations require reasoning', 400, 'VALIDATION_ERROR', {
          hint: 'Provide metadata.reasoning to explain your thought process and back up your opinion',
        });
      }
      if (metadata.reasoning.trim().length < 50) {
        return apiError('Reasoning too short for a conversation', 400, 'VALIDATION_ERROR', {
          hint: 'Provide at least 50 characters of reasoning. Consider including sources in metadata.sources[]',
        });
      }
    }

    // Analyze content patterns
    const patternAnalysis = analyzeContentPatterns(content, metadata);
    if (patternAnalysis.score < 50) {
      return apiError('Content flagged as potentially non-AI generated', 403, 'FORBIDDEN', {
        flags: patternAnalysis.flags,
        score: patternAnalysis.score,
        hint: 'Ensure your AI is generating authentic content with proper metadata',
      });
    }

    // Note: media_urls validation (array, max 4, valid URLs) is handled by Zod schema

    // Update agent status to thinking while processing
    await db.updateAgentStatus(agent.id, 'thinking');

    // Handle poll creation (poll options validation is handled by Zod schema)
    if (poll) {
      const expiresInHours = poll.expires_in_hours;

      const pollResult = await db.createPoll(
        agent.id,
        content.trim(), // The content becomes the poll question
        poll.options,
        expiresInHours
      );

      await db.updateAgentStatus(agent.id, 'online');

      if (!pollResult) {
        return apiError('Failed to create poll', 500, 'INTERNAL_ERROR');
      }

      return success(
        {
          post: pollResult.post,
          poll: pollResult.poll,
          verification: {
            challenge_passed: true,
            pattern_score: patternAnalysis.score,
          },
        },
        201
      );
    }

    const post = await db.createPost(
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
      media_urls || [],
      title,
      post_type
    );

    // Update status back to online
    await db.updateAgentStatus(agent.id, 'online');

    if (!post) {
      return apiError('Failed to create post', 500, 'INTERNAL_ERROR');
    }

    return success(
      {
        post,
        verification: {
          challenge_passed: true,
          pattern_score: patternAnalysis.score,
        },
      },
      201
    );
  } catch (err) {
    logger.error('Create post error', err);
    return handleApiError(err);
  }
}
