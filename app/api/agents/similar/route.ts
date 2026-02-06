import { NextRequest } from 'next/server';
import {
  findSimilarAgents,
  getFingerprint,
  getAgentsByInterest,
  getAllInterests,
  generateSuggestedBio,
} from '@/lib/personality-fingerprint';
import * as db from '@/lib/db-supabase';
import { success, handleApiError, ValidationError, NotFoundError } from '@/lib/api-utils';

// GET /api/agents/similar?agent_id=xxx - Get similar agents based on personality
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get('agent_id');
    const interest = searchParams.get('interest');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);

    // If interest is specified, get agents by interest
    if (interest) {
      const agentIds = getAgentsByInterest(interest);
      const agentsMap = await db.getAgentsByIds(agentIds.slice(0, limit));
      const filteredAgents = agentIds
        .slice(0, limit)
        .map(id => agentsMap[id])
        .filter((a): a is NonNullable<typeof a> => a !== null);

      return success({
        interest,
        agents: filteredAgents.map(a => ({
          id: a.id,
          username: a.username,
          display_name: a.display_name,
          avatar_url: a.avatar_url,
          bio: a.bio,
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
        const agent = await db.getAgentByApiKey(apiKey);
        if (agent) targetAgentId = agent.id;
      }
    }

    if (!targetAgentId) {
      throw new ValidationError('agent_id parameter or Authorization header required');
    }

    // Get fingerprint
    const fingerprint = getFingerprint(targetAgentId);
    if (!fingerprint) {
      throw new NotFoundError(
        'Personality fingerprint. Agent must complete verification to get a personality fingerprint'
      );
    }

    // Find similar agents
    const similar = findSimilarAgents(targetAgentId, limit);

    // Enrich with agent data — batch fetch all agents in a single query
    const similarAgentIds = similar.map(s => s.agentId);
    const agentsMap = await db.getAgentsByIds(similarAgentIds);

    const enrichedSimilar = similar.map(s => {
      const agent = agentsMap[s.agentId] ?? null;
      const fp = getFingerprint(s.agentId);
      return {
        agent: agent
          ? {
              id: agent.id,
              username: agent.username,
              display_name: agent.display_name,
              avatar_url: agent.avatar_url,
              bio: agent.bio,
            }
          : null,
        similarity: Math.round(s.similarity * 100),
        sharedInterests: s.sharedInterests,
        theirInterests: fp?.interests || [],
      };
    });

    const filteredSimilar = enrichedSimilar.filter(s => s.agent !== null);

    // Generate suggested bio
    const suggestedBio = generateSuggestedBio(targetAgentId);

    return success({
      agentId: targetAgentId,
      fingerprint: {
        interests: fingerprint.interests,
        traits: fingerprint.traits,
        style: fingerprint.style,
        expertise: fingerprint.expertise,
      },
      suggestedBio,
      similarAgents: filteredSimilar,
      allInterests: getAllInterests().slice(0, 20),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
