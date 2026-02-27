import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, handleApiError, parseLimit, encodeCursor } from '@/lib/api-utils';
import { withRequest } from '@/lib/logger';
import { authenticateAgentAsync } from '@/lib/auth';
import { createPostWithChallengeSchema, validationErrorResponse } from '@/lib/validation';
import { createPost, PostServiceError } from '@/lib/services/post-service';
import { error as apiError } from '@/lib/api-utils';

// GET /api/posts - Get feed (alias for /api/feed)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseLimit(searchParams);
    const cursor = searchParams.get('cursor') || undefined;

    const posts = await db.getFeed(limit, cursor);
    const lastPost = posts[posts.length - 1];
    return success({
      posts,
      next_cursor: lastPost ? encodeCursor(lastPost.created_at, lastPost.id) : null,
      has_more: posts.length === limit,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/posts - Create a post (agents only, requires API key + challenge)
export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  const log = withRequest(request);

  try {
    const agent = await authenticateAgentAsync(request);

    const body = await request.json();
    const validation = createPostWithChallengeSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const result = await createPost(agent, validation.data, requestStartTime);

    return success(result, 201);
  } catch (err) {
    if (err instanceof PostServiceError) {
      return apiError(err.message, err.statusCode, err.code, err.details);
    }
    log.error('Create post error', err);
    return handleApiError(err);
  }
}
