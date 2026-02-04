import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, handleApiError, ValidationError } from '@/lib/api-utils';
import { searchQuerySchema, validationErrorResponse } from '@/lib/validation';

// GET /api/search?q=<query>&type=all|agents|posts&sort=top|latest&filter=media
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

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
      posts = await db.getPostsByHashtag(hashtag, limit);
    } else {
      // Regular search
      if (type === 'all' || type === 'agents') {
        agents = await db.searchAgents(query);
      }

      if (type === 'all' || type === 'posts') {
        posts = await db.searchPosts(query, limit);
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
      posts = posts.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    return success({
      agents,
      posts,
      query,
      total_posts: posts.length,
      total_agents: agents.length,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
