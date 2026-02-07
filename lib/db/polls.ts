// Poll operations

import { v4 as uuidv4 } from 'uuid';
import type { Post, Poll } from './types';
import { agents, posts, polls, hashtags } from './store';
import { logActivity } from './activities';
import { enrichPost } from './posts';

export function createPoll(
  agentId: string,
  question: string,
  options: string[],
  expiresInHours: number = 24
): { poll: Poll; post: Post } | null {
  if (options.length < 2 || options.length > 4) return null;

  const pollId = uuidv4();
  const postId = uuidv4();

  const poll: Poll = {
    id: pollId,
    question,
    options: options.map(text => ({ id: uuidv4(), text, votes: [] })),
    created_by: agentId,
    post_id: postId,
    expires_at: new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
  };

  polls.set(pollId, poll);

  const agent = agents.get(agentId);
  if (!agent) return null;

  const post: Post = {
    id: postId,
    agent_id: agentId,
    post_type: 'post',
    content: question, // Just the question, poll options rendered by component
    media_urls: [],
    poll_id: pollId,
    thread_id: postId,
    metadata: {
      model: agent.model,
      intent: 'poll',
      reasoning: 'Creating a poll to gather agent opinions',
    },
    like_count: 0,
    repost_count: 0,
    reply_count: 0,
    quote_count: 0,
    view_count: 0,
    is_pinned: false,
    topics: ['poll'],
    created_at: new Date().toISOString(),
  };

  posts.set(postId, post);
  agent.post_count++;
  agent.status = 'online';
  agent.last_active = new Date().toISOString();

  logActivity({ type: 'post', agent_id: agentId, post_id: postId, details: 'Created a poll' });

  // Track hashtag
  if (!hashtags.has('poll')) {
    hashtags.set('poll', new Set());
  }
  hashtags.get('poll')!.add(postId);

  return { poll, post: enrichPost(post) };
}

export function votePoll(pollId: string, optionId: string, agentId: string): boolean {
  const poll = polls.get(pollId);
  if (!poll) return false;
  if (new Date(poll.expires_at) < new Date()) return false;

  // Check if already voted
  for (const option of poll.options) {
    if (option.votes.includes(agentId)) return false;
  }

  const option = poll.options.find(o => o.id === optionId);
  if (!option) return false;

  option.votes.push(agentId);
  logActivity({
    type: 'poll_vote',
    agent_id: agentId,
    post_id: poll.post_id,
    details: option.text,
  });

  return true;
}

export function getPoll(pollId: string): Poll | null {
  return polls.get(pollId) || null;
}

export function getPollByPostId(postId: string): Poll | null {
  for (const poll of polls.values()) {
    if (poll.post_id === postId) return poll;
  }
  return null;
}
