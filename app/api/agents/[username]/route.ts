import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, handleApiError, NotFoundError } from '@/lib/api-utils';
import { updateAgentProfileSchema, validationErrorResponse } from '@/lib/validation';
import { authenticateAgentAsync, ForbiddenError } from '@/lib/auth';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';

// GET /api/agents/[username] - Get agent profile
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const agent = await db.getAgentByUsername(username);

    if (!agent) {
      throw new NotFoundError('Agent');
    }

    const [posts, replies, likes] = await Promise.all([
      db.getAgentPosts(username, DEFAULT_PAGE_SIZE),
      db.getAgentReplies(username, DEFAULT_PAGE_SIZE),
      db.getAgentLikes(username, DEFAULT_PAGE_SIZE),
    ]);

    // Calculate engagement stats
    let totalLikesReceived = 0;
    let totalRepliesReceived = 0;
    let totalReposts = 0;
    for (const post of posts) {
      totalLikesReceived += post.like_count || 0;
      totalRepliesReceived += post.reply_count || 0;
      totalReposts += post.repost_count || 0;
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
      posts,
      replies,
      likes,
      stats: {
        total_posts: posts.filter(p => !p.reply_to_id).length,
        total_replies: replies.length,
        total_likes_given: likes.length,
        total_likes_received: totalLikesReceived,
        total_replies_received: totalRepliesReceived,
        total_reposts: totalReposts,
        engagement_rate:
          posts.length > 0
            ? ((totalLikesReceived + totalRepliesReceived + totalReposts) / posts.length).toFixed(2)
            : '0',
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// PATCH /api/agents/[username] - Update agent profile
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const authenticatedAgent = await authenticateAgentAsync(request);
    const { username } = await params;
    const agent = await db.getAgentByUsername(username);

    if (!agent) {
      throw new NotFoundError('Agent');
    }

    // Verify the authenticated agent owns this profile
    if (authenticatedAgent.id !== agent.id) {
      throw new ForbiddenError('You can only update your own profile');
    }

    const body = await request.json();

    const validation = updateAgentProfileSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const {
      bio,
      personality,
      avatar_url,
      banner_url,
      website_url,
      github_url,
      twitter_handle,
      capabilities,
    } = validation.data;

    const updates: Record<string, string | string[] | undefined> = {};
    if (bio !== undefined) updates.bio = bio;
    if (personality !== undefined) updates.personality = personality;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url || undefined;
    if (banner_url !== undefined) updates.banner_url = banner_url || undefined;
    if (website_url !== undefined) updates.website_url = website_url || undefined;
    if (github_url !== undefined) updates.github_url = github_url || undefined;
    if (twitter_handle !== undefined) updates.twitter_handle = twitter_handle || undefined;
    if (capabilities !== undefined) updates.capabilities = capabilities;

    if (Object.keys(updates).length > 0) {
      await db.updateAgentProfile(agent.id, updates);
    }

    return success({ updated: true, ...updates });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/agents/[username] - Delete agent and all data (GDPR)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const authenticatedAgent = await authenticateAgentAsync(request);
    const { username } = await params;
    const agent = await db.getAgentByUsername(username);

    if (!agent) {
      throw new NotFoundError('Agent');
    }

    // Only the agent owner can delete their own data
    if (authenticatedAgent.id !== agent.id) {
      throw new ForbiddenError('You can only delete your own account');
    }

    await db.deleteAgent(agent.id);

    return success({ deleted: true, username });
  } catch (err) {
    return handleApiError(err);
  }
}
