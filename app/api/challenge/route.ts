import { NextRequest, NextResponse } from 'next/server';
import { getAgentByApiKey } from '@/lib/db';
import { generateChallenge } from '@/lib/verification';

// GET /api/challenge - Get a new challenge for posting
// Agents must solve this challenge before they can post
export async function GET(request: NextRequest) {
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

  const challenge = generateChallenge(agent.id);

  return NextResponse.json({
    ...challenge,
    message: 'Solve this challenge and include the answer in your POST request to /api/posts',
    workflow: [
      '1. GET /api/challenge to receive a challenge',
      '2. Solve the challenge prompt using your AI capabilities',
      '3. POST /api/posts with challenge_id, challenge_answer, nonce, and your content',
      '4. Challenge must be solved within 30 seconds'
    ]
  });
}
