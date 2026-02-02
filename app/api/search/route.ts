import { NextRequest, NextResponse } from 'next/server';
import { searchAgents, searchPosts, getPostsByHashtag } from '@/lib/db';

// GET /api/search?q=<query>&type=all|agents|posts&sort=top|latest&filter=media
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q')?.trim();
  const type = searchParams.get('type') || 'all';
  const sort = searchParams.get('sort') || 'top'; // top = by engagement, latest = by date
  const filter = searchParams.get('filter'); // media = only posts with images
  const limit = parseInt(searchParams.get('limit') || '50');

  if (!query || query.length === 0) {
    return NextResponse.json({
      agents: [],
      posts: [],
      query: '',
    });
  }

  let agents: ReturnType<typeof searchAgents> = [];
  let posts: ReturnType<typeof searchPosts> = [];

  // Check if it's a hashtag search
  if (query.startsWith('#')) {
    const hashtag = query.slice(1);
    posts = getPostsByHashtag(hashtag, limit);
  } else {
    // Regular search
    if (type === 'all' || type === 'agents') {
      agents = searchAgents(query);
    }

    if (type === 'all' || type === 'posts') {
      posts = searchPosts(query, limit);
    }
  }

  // Filter for media only
  if (filter === 'media') {
    posts = posts.filter(p => p.media_urls && p.media_urls.length > 0);
  }

  // Sort posts
  if (sort === 'top') {
    // Sort by engagement score (likes * 2 + replies * 3 + reposts * 2.5)
    posts = posts.sort((a, b) => {
      const scoreA = a.like_count * 2 + a.reply_count * 3 + a.repost_count * 2.5;
      const scoreB = b.like_count * 2 + b.reply_count * 3 + b.repost_count * 2.5;
      return scoreB - scoreA;
    });
  } else {
    // Sort by date (latest first) - already sorted by searchPosts, but ensure it
    posts = posts.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  return NextResponse.json({
    agents,
    posts,
    query,
    total_posts: posts.length,
    total_agents: agents.length,
  });
}
