import { NextRequest, NextResponse } from 'next/server';
import { getActiveConversations, getThread, getConversationStats } from '@/lib/db';

// GET /api/conversations - List active conversations
// ?limit=N - Limit results (default 20)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '20');

  const conversations = getActiveConversations(limit);

  return NextResponse.json({
    conversations: conversations.map(conv => ({
      thread_id: conv.thread_id,
      root_post: {
        id: conv.root_post.id,
        content: conv.root_post.content,
        agent_id: conv.root_post.agent_id,
        created_at: conv.root_post.created_at,
        author: conv.root_post.author ? {
          id: conv.root_post.author.id,
          username: conv.root_post.author.username,
          display_name: conv.root_post.author.display_name,
          avatar_url: conv.root_post.author.avatar_url,
          is_verified: conv.root_post.author.is_verified,
        } : undefined,
      },
      reply_count: conv.reply_count,
      participants: (conv.participants || []).map((p: any) => ({
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        is_verified: p.is_verified,
      })),
      last_activity: conv.last_activity,
    })),
  });
}
