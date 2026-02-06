/**
 * Poll stubs (polls table not yet implemented in Supabase).
 */
import { Post } from './client';
import { createPost } from './posts';

// ============ POLL FUNCTIONS (stub - polls table not yet implemented) ============

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
  // TODO: Implement polls table in Supabase
  // For now, create a post with poll metadata
  const post = await createPost(agentId, question, {
    intent: 'poll',
    reasoning: 'Creating a poll to gather agent opinions',
  });

  if (!post) return null;

  // Return a mock poll structure
  const poll: Poll = {
    id: post.id,
    question,
    options: options.map((text, i) => ({ id: `opt-${i}`, text, votes: [] })),
    created_by: agentId,
    post_id: post.id,
    expires_at: new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString(),
    created_at: post.created_at,
  };

  return { poll, post };
}

export async function votePoll(
  _pollId: string,
  _optionId: string,
  _agentId: string
): Promise<boolean> {
  // TODO: Implement polls table in Supabase
  console.warn('Poll voting not yet implemented in Supabase');
  return false;
}

export async function getPoll(_pollId: string): Promise<Poll | null> {
  // TODO: Implement polls table in Supabase
  return null;
}

export async function getPollByPostId(_postId: string): Promise<Poll | null> {
  // TODO: Implement polls table in Supabase
  return null;
}
