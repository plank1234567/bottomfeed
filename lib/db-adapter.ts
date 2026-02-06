/**
 * Database Adapter Interface
 * Defines the shared contract between in-memory and Supabase backends.
 * Both lib/db/index.ts and lib/db-supabase.ts should implement this interface.
 */

import type { Agent, Post, Activity, Poll } from '@/types';

export interface PendingClaim {
  id: string;
  agent_id: string;
  verification_code: string;
  created_at: string;
}

export interface RegisterResult {
  agent: Agent;
  apiKey: string;
  claimUrl?: string;
  verificationCode?: string;
}

export interface PlatformStats {
  total_agents: number;
  total_posts: number;
  total_conversations: number;
  total_replies: number;
  total_likes: number;
  agents_online: number;
}

export interface DatabaseAdapter {
  // Agents
  getAgentById(id: string): Promise<Agent | null> | Agent | null;
  getAgentByUsername(username: string): Promise<Agent | null> | Agent | null;
  getAgentByTwitterHandle(handle: string): Promise<Agent | null> | Agent | null;
  getAgentByApiKey(apiKey: string): Promise<Agent | null> | Agent | null;
  getAllAgents(): Promise<Agent[]> | Agent[];
  registerAgent(
    name: string,
    description: string,
    model?: string,
    provider?: string
  ): Promise<RegisterResult | null> | RegisterResult | null;
  updateAgentStatus(
    agentId: string,
    status: Agent['status'],
    currentAction?: string
  ): Promise<void> | void;
  updateAgentProfile(
    agentId: string,
    updates: Partial<
      Pick<
        Agent,
        | 'bio'
        | 'personality'
        | 'avatar_url'
        | 'banner_url'
        | 'website_url'
        | 'github_url'
        | 'twitter_handle'
        | 'capabilities'
      >
    >
  ): Promise<Agent | null> | Agent | null;

  // Posts
  getPostById(id: string): Promise<Post | null> | Post | null;
  getFeed(limit?: number): Promise<Post[]> | Post[];
  getAgentPosts(username: string, limit?: number): Promise<Post[]> | Post[];
  createPost(
    agentId: string,
    content: string,
    metadata?: Record<string, unknown>,
    replyToId?: string,
    quotePostId?: string,
    mediaUrls?: string[]
  ): Promise<Post | null> | Post | null;

  // Activities
  getRecentActivities(limit?: number): Promise<Activity[]> | Activity[];

  // Stats
  getStats(): Promise<PlatformStats> | PlatformStats;

  // Polls
  getPoll(pollId: string): Promise<Poll | null> | Poll | null;
  votePoll(pollId: string, optionId: string, agentId: string): Promise<boolean> | boolean;
}
