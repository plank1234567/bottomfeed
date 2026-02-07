import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, handleApiError, ValidationError } from '@/lib/api-utils';
import { searchQuerySchema, validationErrorResponse } from '@/lib/validation';
import { calculateEngagementScore } from '@/lib/constants';

// GET /api/search?q=<query>&type=all|agents|posts&sort=top|latest&filter=media&cursor=ISO8601
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const cursor = searchParams.get('cursor') || undefined;

    // Convert search params to object for Zod validation
    const paramsObj = {
      q: searchParams.get('q') ?? undefined,
      type: searchParams.get('type') ?? undefined,
      sort: searchParams.get('sort') ?? undefined,
      filter: searchParams.get('filter') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    };

    // Validate query parameters with Zod schema
    const validation = searchQuerySchema.safeParse(paramsObj);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const { q, type, sort, filter, limit } = validation.data;
    const query = q?.trim();

    if (!query || query.length === 0) {
      return success({
        agents: [],
        posts: [],
        query: '',
        total_posts: 0,
        total_agents: 0,
        next_cursor: null,
        has_more: false,
      });
    }

    if (query.length < 2) {
      throw new ValidationError('Search query must be at least 2 characters');
    }

    let agents: Awaited<ReturnType<typeof db.searchAgents>> = [];
    let posts: Awaited<ReturnType<typeof db.searchPosts>> = [];

    // Check if it's a hashtag search
    if (query.startsWith('#')) {
      const hashtag = query.slice(1);
      posts = await db.getPostsByHashtag(hashtag, limit, cursor);
    } else {
      // Regular search - run in parallel when both are needed
      if (type === 'all') {
        [agents, posts] = await Promise.all([
          db.searchAgents(query),
          db.searchPosts(query, limit, cursor),
        ]);
      } else if (type === 'agents') {
        agents = await db.searchAgents(query);
      } else if (type === 'posts') {
        posts = await db.searchPosts(query, limit, cursor);
      }
    }

    // Filter for media only
    if (filter === 'media') {
      posts = posts.filter(p => p.media_urls && p.media_urls.length > 0);
    }

    // Sort posts
    if (sort === 'top') {
      // Sort by engagement score using shared weights
      posts = posts.sort((a, b) => {
        return calculateEngagementScore(b) - calculateEngagementScore(a);
      });
    } else {
      // Sort by date (latest first) - already sorted by searchPosts, but ensure it
      posts = posts.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    const lastPost = posts[posts.length - 1];
    return success({
      agents,
      posts,
      query,
      total_posts: posts.length,
      total_agents: agents.length,
      next_cursor: lastPost?.created_at ?? null,
      has_more: posts.length === limit,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
