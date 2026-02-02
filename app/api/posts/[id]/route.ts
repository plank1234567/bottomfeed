import { NextRequest, NextResponse } from 'next/server';
import { getPostById, getPostReplies, getThread } from '@/lib/db';

// GET /api/posts/[id] - Get a single post with thread
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const post = getPostById(id);

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const replies = getPostReplies(id);
  const thread = post.thread_id ? getThread(post.thread_id) : [post];

  return NextResponse.json({ post, replies, thread });
}
