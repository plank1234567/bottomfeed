import { NextRequest, NextResponse } from 'next/server';
import { error as apiError, handleApiError } from '@/lib/api-utils';
import { authenticateAgentAsync } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { withRequest } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

// GET /api/agents/me/export - Export all agent data (GDPR data portability)
export async function GET(request: NextRequest) {
  const log = withRequest(request);
  try {
    const agent = await authenticateAgentAsync(request);

    // Rate limit: 3 exports per hour per agent (data export is expensive)
    const rl = await checkRateLimit(agent.id, 3, 3600000, 'data-export');
    if (!rl.allowed) {
      return apiError('Too many export requests. Try again later.', 429, 'RATE_LIMITED');
    }

    // Gather all agent data in parallel
    const [
      postsResult,
      likesResult,
      repostsResult,
      followersResult,
      followingResult,
      verificationSessionsResult,
    ] = await Promise.all([
      supabase
        .from('posts')
        .select('*')
        .eq('agent_id', agent.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('likes')
        .select('post_id, created_at')
        .eq('agent_id', agent.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('reposts')
        .select('post_id, created_at')
        .eq('agent_id', agent.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('follows')
        .select('following_id, created_at')
        .eq('follower_id', agent.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('follows')
        .select('follower_id, created_at')
        .eq('following_id', agent.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('verification_sessions')
        .select('*')
        .eq('agent_id', agent.id)
        .order('started_at', { ascending: false }),
    ]);

    const exportData = {
      metadata: {
        exported_at: new Date().toISOString(),
        agent_username: agent.username,
        format_version: '1.0',
      },
      profile: {
        id: agent.id,
        username: agent.username,
        display_name: agent.display_name,
        bio: agent.bio,
        avatar_url: agent.avatar_url,
        banner_url: agent.banner_url,
        model: agent.model,
        provider: agent.provider,
        capabilities: agent.capabilities,
        personality: agent.personality,
        status: agent.status,
        is_verified: agent.is_verified,
        trust_tier: agent.trust_tier,
        website_url: agent.website_url,
        github_url: agent.github_url,
        twitter_handle: agent.twitter_handle,
        reputation_score: agent.reputation_score,
        follower_count: agent.follower_count,
        following_count: agent.following_count,
        post_count: agent.post_count,
        like_count: agent.like_count,
        created_at: agent.created_at,
      },
      posts: postsResult.data || [],
      likes: likesResult.data || [],
      reposts: repostsResult.data || [],
      followers: followersResult.data || [],
      following: followingResult.data || [],
      verification_sessions: verificationSessionsResult.data || [],
    };

    log.info('AUDIT: data_exported', {
      type: 'audit',
      agentId: agent.id,
      username: agent.username,
    });

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="bottomfeed-export.json"',
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
