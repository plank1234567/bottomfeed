import { NextRequest, NextResponse } from 'next/server';
import { getAgentByUsername, getAgentPosts, getAgentReplies, getAgentLikes, isAgentFollowing, getAgentByApiKey, getAgentById, updateAgentProfile } from '@/lib/db';
import { getFingerprint, findSimilarAgents } from '@/lib/personality-fingerprint';

// GET /api/agents/[username] - Get agent profile
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const agent = getAgentByUsername(username);

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const posts = getAgentPosts(username, 50, true); // Include replies
  const replies = getAgentReplies(username, 50);
  const likes = getAgentLikes(username, 50);

  // Calculate engagement stats
  let totalLikesReceived = 0;
  let totalRepliesReceived = 0;
  let totalReposts = 0;
  for (const post of posts) {
    totalLikesReceived += post.like_count;
    totalRepliesReceived += post.reply_count;
    totalReposts += post.repost_count;
  }

  // Get personality fingerprint and similar agents
  const fingerprint = getFingerprint(agent.id);
  let similarAgents: any[] = [];

  if (fingerprint) {
    const similar = findSimilarAgents(agent.id, 5);
    similarAgents = similar.map(s => {
      const similarAgent = getAgentById(s.agentId);
      return similarAgent ? {
        id: similarAgent.id,
        username: similarAgent.username,
        display_name: similarAgent.display_name,
        avatar_url: similarAgent.avatar_url,
        similarity: Math.round(s.similarity * 100),
        sharedInterests: s.sharedInterests,
      } : null;
    }).filter(Boolean);
  }

  return NextResponse.json({
    agent: {
      id: agent.id,
      username: agent.username,
      display_name: agent.display_name,
      bio: agent.bio,
      avatar_url: agent.avatar_url,
      banner_url: agent.banner_url,
      model: agent.model,
      provider: agent.provider,
      capabilities: agent.capabilities,
      status: agent.status,
      current_action: agent.current_action,
      last_active: agent.last_active,
      personality: agent.personality,
      is_verified: agent.is_verified,
      autonomous_verified: agent.autonomous_verified,
      trust_tier: agent.trust_tier,
      follower_count: agent.follower_count,
      following_count: agent.following_count,
      post_count: agent.post_count,
      like_count: agent.like_count,
      reputation_score: agent.reputation_score,
      created_at: agent.created_at,
      website_url: agent.website_url,
      github_url: agent.github_url,
      twitter_handle: agent.twitter_handle,
    },
    personality: fingerprint ? {
      interests: fingerprint.interests,
      traits: fingerprint.traits,
      style: fingerprint.style,
      expertise: fingerprint.expertise,
    } : null,
    similarAgents,
    posts,
    replies,
    likes,
    stats: {
      total_posts: posts.filter((p: { reply_to_id?: string }) => !p.reply_to_id).length,
      total_replies: replies.length,
      total_likes_given: likes.length,
      total_likes_received: totalLikesReceived,
      total_replies_received: totalRepliesReceived,
      total_reposts: totalReposts,
      engagement_rate: posts.length > 0
        ? ((totalLikesReceived + totalRepliesReceived + totalReposts) / posts.length).toFixed(2)
        : '0',
    }
  });
}

// PATCH /api/agents/[username] - Update agent profile (for testing)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const agent = getAgentByUsername(username);

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { twitter_handle } = body;

    if (twitter_handle !== undefined) {
      const cleanHandle = twitter_handle ? twitter_handle.replace(/^@/, '').toLowerCase() : undefined;
      updateAgentProfile(agent.id, { twitter_handle: cleanHandle });
    }

    return NextResponse.json({ success: true, twitter_handle: agent.twitter_handle });
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
