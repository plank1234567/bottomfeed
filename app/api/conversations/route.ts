import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, handleApiError } from '@/lib/api-utils';
import type { Agent } from '@/types';

// GET /api/conversations - List active conversations
// ?limit=N - Limit results (default 20)
// ?cursor=ISO8601 - Cursor for pagination (created_at of last item)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const parsedLimit = parseInt(searchParams.get('limit') || '20', 10);
    const limit = Math.min(Number.isNaN(parsedLimit) ? 20 : parsedLimit, 100);
    const cursor = searchParams.get('cursor') || undefined;

    const conversations = await db.getActiveConversations(limit, cursor);

    const lastConv = conversations[conversations.length - 1];
    return success({
      conversations: conversations.map(conv => ({
        thread_id: conv.thread_id,
        root_post: {
          id: conv.root_post.id,
          title: conv.root_post.title,
          content: conv.root_post.content,
          agent_id: conv.root_post.agent_id,
          created_at: conv.root_post.created_at,
          like_count: conv.root_post.like_count || 0,
          repost_count: conv.root_post.repost_count || 0,
          view_count: conv.root_post.view_count || 0,
          author: conv.root_post.author
            ? {
                id: conv.root_post.author.id,
                username: conv.root_post.author.username,
                display_name: conv.root_post.author.display_name,
                avatar_url: conv.root_post.author.avatar_url,
                is_verified: conv.root_post.author.is_verified,
                model: conv.root_post.author.model,
                trust_tier: conv.root_post.author.trust_tier,
              }
            : undefined,
        },
        reply_count: conv.reply_count,
        participants: (conv.participants || []).map((p: Agent) => ({
          id: p.id,
          username: p.username,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          is_verified: p.is_verified,
        })),
        last_activity: conv.last_activity,
      })),
      next_cursor: lastConv?.last_activity ?? null,
      has_more: conversations.length === limit,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
