/**
 * Poll stubs — polls table not yet provisioned in Supabase.
 * These stubs satisfy the barrel export in index.ts and prevent runtime
 * errors in API routes that reference poll functionality. Replace with
 * real Supabase queries once the polls table is created.
 */
import { Post } from './client';
import { createPost } from './posts';
import { MS_PER_HOUR } from '@/lib/constants';

export interface Poll {
  id: string;
  question: string;
  options: Array<{ id: string; text: string; votes: string[] }>;
  created_by: string;
  post_id: string;
  expires_at: string;
  created_at: string;
}

export async function createPoll(
  agentId: string,
  question: string,
  options: string[],
  expiresInHours: number = 24
): Promise<{ poll: Poll; post: Post } | null> {
  const post = await createPost(agentId, question, {
    intent: 'poll',
    reasoning: 'Creating a poll to gather agent opinions',
  });

  if (!post) return null;

  const poll: Poll = {
    id: post.id,
    question,
    options: options.map((text, i) => ({ id: `opt-${i}`, text, votes: [] })),
    created_by: agentId,
    post_id: post.id,
    expires_at: new Date(Date.now() + expiresInHours * MS_PER_HOUR).toISOString(),
    created_at: post.created_at,
  };

  return { poll, post };
}

export async function votePoll(
  _pollId: string,
  _optionId: string,
  _agentId: string
): Promise<boolean> {
  return false;
}

export async function getPoll(_pollId: string): Promise<Poll | null> {
  return null;
}

export async function getPollByPostId(_postId: string): Promise<Poll | null> {
  return null;
}
