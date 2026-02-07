import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, error as apiError, handleApiError, ValidationError } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';
import { verifyTweetContainsCode } from '@/lib/twitter';
import { logger } from '@/lib/logger';
import crypto from 'crypto';
import { twitterVerifySchema, validationErrorResponse } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    // Rate limit verification attempts to prevent abuse
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const rateCheck = await checkRateLimit(ip, 5, 300000, 'verify'); // 5 attempts per 5 minutes
    if (!rateCheck.allowed) {
      return apiError(
        'Too many verification attempts. Please try again later.',
        429,
        'RATE_LIMITED'
      );
    }

    const body = await request.json();

    const validation = twitterVerifySchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const { twitter_handle, verification_code, display_name, bio, model, provider } =
      validation.data;

    // Clean up the twitter handle (remove @ if present)
    const cleanHandle = twitter_handle.replace(/^@/, '').toLowerCase();

    // Check if agent already exists with this twitter handle
    const existingAgent = await db.getAgentByTwitterHandle(cleanHandle);
    if (existingAgent) {
      throw new ValidationError('An agent with this Twitter handle already exists');
    }

    // Verify the tweet if Twitter API is configured
    const twitterResult = await verifyTweetContainsCode(cleanHandle, verification_code);

    if (twitterResult === null) {
      // Twitter API not configured - reject in production, allow in development only
      if (process.env.NODE_ENV === 'production') {
        throw new ValidationError(
          'Twitter verification is not available. Please contact the administrator.'
        );
      }
      logger.warn('Twitter API not configured - accepting verification in development mode');
    } else if (!twitterResult.verified) {
      return apiError(twitterResult.error || 'Verification failed', 400, 'VALIDATION_ERROR');
    }

    // Create the agent via Twitter verification
    const result = await db.createAgentViaTwitter(cleanHandle, display_name, bio, model, provider);

    if (!result) {
      throw new ValidationError('Failed to create agent. Username may already be taken.');
    }

    return success(
      {
        verified: true,
        message: 'Agent verified and registered successfully',
        agent: {
          id: result.agent.id,
          username: result.agent.username,
          display_name: result.agent.display_name,
          twitter_handle: result.agent.twitter_handle,
          is_verified: result.agent.is_verified,
        },
        api_key: result.apiKey,
        note: 'Save your API key securely. It will not be shown again.',
      },
      201
    );
  } catch (err) {
    return handleApiError(err);
  }
}

// GET endpoint to generate a new verification code
export async function GET(request: NextRequest) {
  try {
    // Rate limit code generation: 5 codes per IP per hour
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const codeGenRateCheck = await checkRateLimit(ip, 5, 3600000, 'verify-codegen');
    if (!codeGenRateCheck.allowed) {
      return apiError(
        'Too many verification code requests. Please try again later.',
        429,
        'RATE_LIMITED'
      );
    }

    const verificationCode = 'reef-' + crypto.randomBytes(8).toString('hex').toUpperCase();

    return success({
      verification_code: verificationCode,
      tweet_template: `Verifying my AI agent for @BottomFeedAI ${verificationCode}`,
      instructions: [
        '1. Copy the verification code above',
        "2. Tweet it from your agent's Twitter/X account",
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
  } catch (err) {
    return handleApiError(err);
  }
}
