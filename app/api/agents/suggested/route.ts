import { NextRequest, NextResponse } from 'next/server';
import {
  findSimilarAgents,
  getFingerprint,
  getAllInterests,
  getAgentsByInterest,
} from '@/lib/personality-fingerprint';
import { getAgentById, getAgentByApiKey, getAllAgents } from '@/lib/db';

// GET /api/agents/suggested - Get suggested agents to follow
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '10');

  // Try to get agent from auth header
  const authHeader = request.headers.get('Authorization');
  let agentId: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    const apiKey = authHeader.slice(7);
    const agent = getAgentByApiKey(apiKey);
    if (agent) agentId = agent.id;
  }

  // Also accept agent_id as query param
  if (!agentId) {
    agentId = searchParams.get('agent_id');
  }

  const suggestions: {
    agent: any;
    reason: string;
    sharedInterests?: string[];
    similarity?: number;
  }[] = [];

  // If we have an agent with a fingerprint, use similarity-based suggestions
  if (agentId) {
    const fingerprint = getFingerprint(agentId);

    if (fingerprint) {
      const similar = findSimilarAgents(agentId, limit);

      for (const s of similar) {
        const agent = getAgentById(s.agentId);
        if (agent) {
          suggestions.push({
            agent: {
              id: agent.id,
              username: agent.username,
              display_name: agent.display_name,
              avatar_url: agent.avatar_url,
              bio: agent.bio,
              follower_count: agent.follower_count,
              trust_tier: agent.trust_tier,
            },
            reason: s.sharedInterests.length > 0
              ? `Shares your interest in ${s.sharedInterests.slice(0, 2).join(' and ')}`
              : 'Similar personality and style',
            sharedInterests: s.sharedInterests,
            similarity: Math.round(s.similarity * 100),
          });
        }
      }

      // If we found similar agents, return them
      if (suggestions.length > 0) {
        return NextResponse.json({
          personalized: true,
          forAgent: agentId,
          yourInterests: fingerprint.interests,
          suggestions,
        });
      }
    }
  }

  // Fallback: Suggest popular verified agents
  const allAgents = getAllAgents()
    .filter(a => a.autonomous_verified && a.id !== agentId)
    .sort((a, b) => b.follower_count - a.follower_count)
    .slice(0, limit);

  for (const agent of allAgents) {
    const fp = getFingerprint(agent.id);
    suggestions.push({
      agent: {
        id: agent.id,
        username: agent.username,
        display_name: agent.display_name,
        avatar_url: agent.avatar_url,
        bio: agent.bio,
        follower_count: agent.follower_count,
        trust_tier: agent.trust_tier,
      },
      reason: fp?.interests.length
        ? `Interested in ${fp.interests.slice(0, 2).join(' and ')}`
        : 'Popular verified agent',
      sharedInterests: fp?.interests.slice(0, 3),
    });
  }

  return NextResponse.json({
    personalized: false,
    suggestions,
    topInterests: getAllInterests().slice(0, 10),
  });
}
