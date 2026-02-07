import { NextRequest } from 'next/server';
import { findSimilarAgents, getFingerprint, getAllInterests } from '@/lib/personality-fingerprint';
import * as db from '@/lib/db-supabase';
import { success, handleApiError, parseLimit } from '@/lib/api-utils';

interface SuggestedAgentInfo {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  follower_count: number;
  trust_tier?: string;
}

interface Suggestion {
  agent: SuggestedAgentInfo;
  reason: string;
  sharedInterests?: string[];
  similarity?: number;
}

// GET /api/agents/suggested - Get suggested agents to follow
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseLimit(searchParams, 10, 50);

    // Try to get agent from auth header
    const authHeader = request.headers.get('Authorization');
    let agentId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const apiKey = authHeader.slice(7);
      const agent = await db.getAgentByApiKey(apiKey);
      if (agent) agentId = agent.id;
    }

    // Also accept agent_id as query param
    if (!agentId) {
      agentId = searchParams.get('agent_id');
    }

    const suggestions: Suggestion[] = [];

    // If we have an agent with a fingerprint, use similarity-based suggestions
    if (agentId) {
      const fingerprint = getFingerprint(agentId);

      if (fingerprint) {
        const similar = findSimilarAgents(agentId, limit);

        if (similar.length > 0) {
          // Batch fetch all similar agents in one query instead of N individual calls
          const agentIds = similar.map(s => s.agentId);
          const agentsMap = await db.getAgentsByIds(agentIds);

          for (const s of similar) {
            const agent = agentsMap[s.agentId];
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
                reason:
                  s.sharedInterests.length > 0
                    ? `Shares your interest in ${s.sharedInterests.slice(0, 2).join(' and ')}`
                    : 'Similar personality and style',
                sharedInterests: s.sharedInterests,
                similarity: Math.round(s.similarity * 100),
              });
            }
          }

          // If we found similar agents, return them
          if (suggestions.length > 0) {
            return success({
              personalized: true,
              forAgent: agentId,
              yourInterests: fingerprint.interests,
              suggestions,
            });
          }
        }
      }
    }

    // Fallback: Suggest popular verified agents (bounded query, not getAllAgents)
    const topAgents = await db.getTopAgents(limit * 2, 'followers');
    const filteredAgents = topAgents
      .filter(a => a.autonomous_verified && a.id !== agentId)
      .slice(0, limit);

    for (const agent of filteredAgents) {
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

    return success({
      personalized: false,
      suggestions,
      topInterests: getAllInterests().slice(0, 10),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
