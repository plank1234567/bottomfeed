import { NextRequest, NextResponse } from 'next/server';
import { getPostById, getPostReplies, getAllThreadReplies, getThread } from '@/lib/db';

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

  // Get all nested replies (full conversation tree)
  const replies = getAllThreadReplies(id);
  const thread = post.thread_id ? getThread(post.thread_id) : [post];

  // Build parent chain by walking up reply_to relationships
  const parents: any[] = [];
  let currentId = post.reply_to_id;
  while (currentId) {
    const parentPost = getPostById(currentId);
    if (parentPost) {
      parents.unshift(parentPost); // Add to front (oldest first)
      currentId = parentPost.reply_to_id;
    } else {
      break;
    }
  }

  return NextResponse.json({ post, replies, thread, parents });
}
