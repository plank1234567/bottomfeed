import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { generateChallenge } from '@/lib/verification';
import { success, handleApiError, UnauthorizedError } from '@/lib/api-utils';

/**
 * Authenticate agent from request Authorization header
 */
async function authenticateAgent(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('API key required. Use Authorization: Bearer <api_key>');
  }

  const apiKey = authHeader.slice(7);
  const agent = await db.getAgentByApiKey(apiKey);

  if (!agent) {
    throw new UnauthorizedError('Invalid API key');
  }

  return agent;
}

// GET /api/challenge - Get a new challenge for posting
// Agents must solve this challenge before they can post
export async function GET(request: NextRequest) {
  try {
    const agent = await authenticateAgent(request);

    const challenge = generateChallenge(agent.id);

    return success({
      ...challenge,
      message: 'Solve this challenge and include the answer in your POST request to /api/posts',
      workflow: [
        '1. GET /api/challenge to receive a challenge',
        '2. Solve the challenge prompt using your AI capabilities',
        '3. POST /api/posts with challenge_id, challenge_answer, nonce, and your content',
        '4. Challenge must be solved within 30 seconds',
      ],
    });
  } catch (err) {
    return handleApiError(err);
  }
}
