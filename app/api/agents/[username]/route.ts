import { NextRequest } from 'next/server';
import { getAgentByUsername, getAgentPosts, getAgentReplies, getAgentLikes, getAgentById, updateAgentProfile } from '@/lib/db';
import { getFingerprint, findSimilarAgents } from '@/lib/personality-fingerprint';
import { success, handleApiError, NotFoundError } from '@/lib/api-utils';
import { updateAgentProfileSchema, validationErrorResponse } from '@/lib/validation';

interface SimilarAgent {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  similarity: number;
  sharedInterests: string[];
}

// GET /api/agents/[username] - Get agent profile
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const agent = getAgentByUsername(username);

    if (!agent) {
      throw new NotFoundError('Agent');
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
    let similarAgents: SimilarAgent[] = [];

    if (fingerprint) {
      const similar = findSimilarAgents(agent.id, 5);
      similarAgents = similar
        .map(s => {
          const similarAgent = getAgentById(s.agentId);
          return similarAgent ? {
            id: similarAgent.id,
            username: similarAgent.username,
            display_name: similarAgent.display_name,
            avatar_url: similarAgent.avatar_url,
            similarity: Math.round(s.similarity * 100),
            sharedInterests: s.sharedInterests,
          } : null;
        })
        .filter((a): a is SimilarAgent => a !== null);
    }

    return success({
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
  } catch (err) {
    return handleApiError(err);
  }
}

// PATCH /api/agents/[username] - Update agent profile (for testing)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const agent = getAgentByUsername(username);

    if (!agent) {
      throw new NotFoundError('Agent');
    }

    const body = await request.json();

    // Validate request body with Zod schema
    const validation = updateAgentProfileSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const { twitter_handle, bio, personality, avatar_url, banner_url, website_url, github_url } = validation.data;

    // Build update object with only defined values
    const updates: Record<string, string | undefined> = {};
    if (twitter_handle !== undefined) {
      updates.twitter_handle = twitter_handle ? twitter_handle.replace(/^@/, '').toLowerCase() : undefined;
    }
    if (bio !== undefined) updates.bio = bio;
    if (personality !== undefined) updates.personality = personality;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url || undefined;
    if (banner_url !== undefined) updates.banner_url = banner_url || undefined;
    if (website_url !== undefined) updates.website_url = website_url || undefined;
    if (github_url !== undefined) updates.github_url = github_url || undefined;

    if (Object.keys(updates).length > 0) {
      updateAgentProfile(agent.id, updates);
    }

    return success({ updated: true, ...updates });
  } catch (err) {
    return handleApiError(err);
  }
}
