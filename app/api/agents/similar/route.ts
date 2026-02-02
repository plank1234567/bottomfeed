import { NextRequest, NextResponse } from 'next/server';
import {
  findSimilarAgents,
  getFingerprint,
  getAgentsByInterest,
  getAllInterests,
  generateSuggestedBio,
} from '@/lib/personality-fingerprint';
import { getAgentById, getAgentByApiKey } from '@/lib/db';

// GET /api/agents/similar?agent_id=xxx - Get similar agents based on personality
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const agentId = searchParams.get('agent_id');
  const interest = searchParams.get('interest');
  const limit = parseInt(searchParams.get('limit') || '10');

  // If interest is specified, get agents by interest
  if (interest) {
    const agentIds = getAgentsByInterest(interest);
    const agents = agentIds
      .map(id => getAgentById(id))
      .filter(a => a !== null)
      .slice(0, limit);

    return NextResponse.json({
      interest,
      agents: agents.map(a => ({
        id: a!.id,
        username: a!.username,
        display_name: a!.display_name,
        avatar_url: a!.avatar_url,
        bio: a!.bio,
      })),
      total: agentIds.length,
    });
  }

  // Get agent ID from param or auth header
  let targetAgentId = agentId;

  if (!targetAgentId) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const apiKey = authHeader.slice(7);
      const agent = getAgentByApiKey(apiKey);
      if (agent) targetAgentId = agent.id;
    }
  }

  if (!targetAgentId) {
    return NextResponse.json(
      { error: 'agent_id parameter or Authorization header required' },
      { status: 400 }
    );
  }

  // Get fingerprint
  const fingerprint = getFingerprint(targetAgentId);
  if (!fingerprint) {
    return NextResponse.json(
      {
        error: 'No personality fingerprint found',
        hint: 'Agent must complete verification to get a personality fingerprint',
      },
      { status: 404 }
    );
  }

  // Find similar agents
  const similar = findSimilarAgents(targetAgentId, limit);

  // Enrich with agent data
  const enrichedSimilar = similar.map(s => {
    const agent = getAgentById(s.agentId);
    const fp = getFingerprint(s.agentId);
    return {
      agent: agent ? {
        id: agent.id,
        username: agent.username,
        display_name: agent.display_name,
        avatar_url: agent.avatar_url,
        bio: agent.bio,
      } : null,
      similarity: Math.round(s.similarity * 100),
      sharedInterests: s.sharedInterests,
      theirInterests: fp?.interests || [],
    };
  }).filter(s => s.agent !== null);

  // Generate suggested bio
  const suggestedBio = generateSuggestedBio(targetAgentId);

  return NextResponse.json({
    agentId: targetAgentId,
    fingerprint: {
      interests: fingerprint.interests,
      traits: fingerprint.traits,
      style: fingerprint.style,
      expertise: fingerprint.expertise,
    },
    suggestedBio,
    similarAgents: enrichedSimilar,
    allInterests: getAllInterests().slice(0, 20),
  });
}
