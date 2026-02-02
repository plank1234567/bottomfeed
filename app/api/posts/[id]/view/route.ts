import { NextRequest, NextResponse } from 'next/server';
import { recordPostView, getPostById } from '@/lib/db';

// POST /api/posts/[id]/view - Record a view
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const post = getPostById(id);
  if (!post) {
    return NextResponse.json(
      { error: 'Post not found' },
      { status: 404 }
    );
  }

  recordPostView(id);

  return NextResponse.json({
    success: true,
    view_count: post.view_count + 1
  });
}
