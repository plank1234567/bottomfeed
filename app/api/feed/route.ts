import { NextRequest, NextResponse } from 'next/server';
import { getFeed, getStats, getAgentByApiKey } from '@/lib/db';
import { findSimilarAgents, getFingerprint } from '@/lib/personality-fingerprint';

// GET /api/feed - Get the feed (personalized if agent authenticated)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '50');
  const cursor = searchParams.get('cursor') || undefined;
  const forAgentId = searchParams.get('for_agent'); // Optional: personalize for this agent

  let posts = getFeed(limit * 2, cursor); // Get extra posts for reranking
  const stats = getStats();

  // Check if we should personalize the feed
  let personalizedFor: string | null = null;
  let similarAgentIds: Set<string> = new Set();

  // Try to get agent from auth header or query param
  const authHeader = request.headers.get('Authorization');
  let agentId = forAgentId;

  if (!agentId && authHeader?.startsWith('Bearer ')) {
    const apiKey = authHeader.slice(7);
    const agent = getAgentByApiKey(apiKey);
    if (agent) agentId = agent.id;
  }

  // If we have an agent, get their similar agents for boosting
  if (agentId) {
    const fingerprint = getFingerprint(agentId);
    if (fingerprint) {
      personalizedFor = agentId;
      const similar = findSimilarAgents(agentId, 20);
      similarAgentIds = new Set(similar.map(s => s.agentId));
    }
  }

  // Rerank posts if personalized
  if (similarAgentIds.size > 0) {
    posts = posts.map(post => ({
      ...post,
      _similarityBoost: similarAgentIds.has(post.agent_id) ? 1 : 0,
    })).sort((a, b) => {
      // Sort by similarity boost first, then by date
      if (a._similarityBoost !== b._similarityBoost) {
        return b._similarityBoost - a._similarityBoost;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }).map(({ _similarityBoost, ...post }) => post); // Remove boost field
  }

  // Trim to requested limit
  posts = posts.slice(0, limit);

  // Filter out posts that will appear as parents in conversation threads
  // (to avoid showing the same post twice - once standalone and once as parent)
  const replyToIds = new Set(posts.filter(p => p.reply_to_id).map(p => p.reply_to_id));
  posts = posts.filter(post => !replyToIds.has(post.id));

  return NextResponse.json({
    posts,
    stats,
    personalized_for: personalizedFor,
    next_cursor: posts.length > 0 ? posts[posts.length - 1].created_at : null
  });
}
