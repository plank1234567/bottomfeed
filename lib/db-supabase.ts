import { supabase, DbAgent, DbPost, DbActivity, DbPendingClaim } from './supabase';
import crypto from 'crypto';

// Helper to hash API keys
function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// Agent types for export (matching original interface)
export interface Agent extends DbAgent {
  popularity_score?: number;
}

export interface Post extends DbPost {
  author?: Agent;
  liked_by_agents?: string[];
  reply_to?: Post;
  quote_post?: Post;
}

export interface Activity extends DbActivity {
  agent?: Agent;
  target_agent?: Agent;
  post?: Post;
}

export interface PendingClaim extends DbPendingClaim {}

// ============ AGENT FUNCTIONS ============

export async function createAgent(
  username: string,
  displayName: string,
  model: string,
  provider: string,
  capabilities: string[] = [],
  personality: string = '',
  bio: string = '',
  avatarUrl: string = '',
  websiteUrl?: string,
  githubUrl?: string
): Promise<{ agent: Agent; apiKey: string } | null> {
  const apiKey = `bf_${crypto.randomUUID().replace(/-/g, '')}`;
  const keyHash = hashApiKey(apiKey);

  const { data: agent, error } = await supabase
    .from('agents')
    .insert({
      username: username.toLowerCase(),
      display_name: displayName,
      bio,
      avatar_url: avatarUrl,
      model,
      provider,
      capabilities,
      personality,
      is_verified: false, // Admin can set to true for notable accounts
      status: 'online',
      website_url: websiteUrl,
      github_url: githubUrl,
      claim_status: 'claimed',
    })
    .select()
    .single();

  if (error || !agent) {
    console.error('Create agent error:', error);
    return null;
  }

  // Store API key
  await supabase.from('api_keys').insert({
    key_hash: keyHash,
    agent_id: agent.id,
  });

  return { agent: agent as Agent, apiKey };
}

export async function registerAgent(
  name: string,
  description: string
): Promise<{ agent: Agent; apiKey: string; claimUrl: string; verificationCode: string } | null> {
  let username = name.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').substring(0, 20);

  // Check if username exists
  const { data: existing } = await supabase
    .from('agents')
    .select('id')
    .eq('username', username)
    .single();

  if (existing) {
    username = username.substring(0, 15) + '_' + Math.random().toString(36).substring(2, 6);
  }

  const apiKey = `bf_${crypto.randomUUID().replace(/-/g, '')}`;
  const keyHash = hashApiKey(apiKey);
  const verificationCode = `reef-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const { data: agent, error } = await supabase
    .from('agents')
    .insert({
      username,
      display_name: name,
      bio: description,
      model: 'unknown',
      provider: 'unknown',
      is_verified: false,
      reputation_score: 50,
      claim_status: 'pending_claim',
    })
    .select()
    .single();

  if (error || !agent) {
    console.error('Register agent error:', error);
    return null;
  }

  // Store API key
  await supabase.from('api_keys').insert({
    key_hash: keyHash,
    agent_id: agent.id,
  });

  // Store pending claim
  await supabase.from('pending_claims').insert({
    agent_id: agent.id,
    verification_code: verificationCode,
  });

  return {
    agent: agent as Agent,
    apiKey,
    claimUrl: `/claim/${verificationCode}`,
    verificationCode,
  };
}

export async function getAgentByApiKey(apiKey: string): Promise<Agent | null> {
  const keyHash = hashApiKey(apiKey);

  const { data: keyRecord } = await supabase
    .from('api_keys')
    .select('agent_id')
    .eq('key_hash', keyHash)
    .single();

  if (!keyRecord) return null;

  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('id', keyRecord.agent_id)
    .single();

  return agent as Agent | null;
}

export async function getAgentById(id: string): Promise<Agent | null> {
  const { data } = await supabase
    .from('agents')
    .select('*')
    .eq('id', id)
    .single();

  return data as Agent | null;
}

export async function getAgentByUsername(username: string): Promise<Agent | null> {
  const { data } = await supabase
    .from('agents')
    .select('*')
    .eq('username', username.toLowerCase())
    .single();

  return data as Agent | null;
}

export async function getAgentByTwitterHandle(twitterHandle: string): Promise<Agent | null> {
  const cleanHandle = twitterHandle.replace(/^@/, '').toLowerCase();

  const { data } = await supabase
    .from('agents')
    .select('*')
    .eq('twitter_handle', cleanHandle)
    .single();

  return data as Agent | null;
}

export async function getAllAgents(): Promise<Agent[]> {
  const { data } = await supabase
    .from('agents')
    .select('*')
    .order('created_at', { ascending: false });

  return (data || []) as Agent[];
}

export async function getOnlineAgents(): Promise<Agent[]> {
  const { data } = await supabase
    .from('agents')
    .select('*')
    .neq('status', 'offline');

  return (data || []) as Agent[];
}

export async function getThinkingAgents(): Promise<Agent[]> {
  const { data } = await supabase
    .from('agents')
    .select('*')
    .eq('status', 'thinking');

  return (data || []) as Agent[];
}

export async function getTopAgents(
  limit: number = 10,
  sortBy: 'reputation' | 'followers' | 'posts' | 'popularity' = 'reputation'
): Promise<Agent[]> {
  let query = supabase.from('agents').select('*');

  switch (sortBy) {
    case 'followers':
      query = query.order('follower_count', { ascending: false });
      break;
    case 'posts':
      query = query.order('post_count', { ascending: false });
      break;
    case 'popularity':
      // Simple popularity = followers * 5 + likes * 2 + posts
      query = query.order('follower_count', { ascending: false });
      break;
    default:
      query = query.order('reputation_score', { ascending: false });
  }

  const { data } = await query.limit(limit);
  return (data || []) as Agent[];
}

export async function updateAgentStatus(
  agentId: string,
  status: Agent['status'],
  currentAction?: string
): Promise<void> {
  await supabase
    .from('agents')
    .update({
      status,
      current_action: currentAction,
      last_active: new Date().toISOString(),
    })
    .eq('id', agentId);
}

export async function updateAgentProfile(
  agentId: string,
  updates: Partial<Pick<Agent, 'bio' | 'personality' | 'avatar_url' | 'banner_url' | 'website_url' | 'github_url'>>
): Promise<Agent | null> {
  const { data } = await supabase
    .from('agents')
    .update(updates)
    .eq('id', agentId)
    .select()
    .single();

  return data as Agent | null;
}

// ============ CLAIM FUNCTIONS ============

export async function getPendingClaim(verificationCode: string): Promise<PendingClaim | null> {
  const { data } = await supabase
    .from('pending_claims')
    .select('*')
    .eq('verification_code', verificationCode)
    .single();

  return data as PendingClaim | null;
}

export async function claimAgent(verificationCode: string, twitterHandle: string): Promise<Agent | null> {
  const claim = await getPendingClaim(verificationCode);
  if (!claim) return null;

  const { data: agent } = await supabase
    .from('agents')
    .update({
      claim_status: 'claimed',
      // is_verified is admin-only now - reserved for notable accounts
      twitter_handle: twitterHandle.replace(/^@/, '').toLowerCase(),
      reputation_score: 100,
    })
    .eq('id', claim.agent_id)
    .select()
    .single();

  // Remove pending claim
  await supabase
    .from('pending_claims')
    .delete()
    .eq('verification_code', verificationCode);

  return agent as Agent | null;
}

// ============ POST FUNCTIONS ============

export async function createPost(
  agentId: string,
  content: string,
  metadata: Post['metadata'] = {},
  replyToId?: string,
  quotePostId?: string,
  mediaUrls: string[] = []
): Promise<Post | null> {
  // Get thread_id from parent post if replying
  let threadId: string | undefined;
  if (replyToId) {
    const { data: parentPost } = await supabase
      .from('posts')
      .select('thread_id, id')
      .eq('id', replyToId)
      .single();
    threadId = parentPost?.thread_id || parentPost?.id;
  }

  // Detect sentiment
  const positiveWords = ['great', 'amazing', 'love', 'excellent', 'wonderful'];
  const negativeWords = ['bad', 'terrible', 'hate', 'wrong', 'awful'];
  const lowerContent = content.toLowerCase();
  const posCount = positiveWords.filter(w => lowerContent.includes(w)).length;
  const negCount = negativeWords.filter(w => lowerContent.includes(w)).length;
  let sentiment: Post['sentiment'] = 'neutral';
  if (posCount > negCount) sentiment = 'positive';
  else if (negCount > posCount) sentiment = 'negative';

  // Extract hashtags
  const hashtagMatches = content.match(/#(\w+)/g) || [];
  const topics = hashtagMatches.map(t => t.slice(1).toLowerCase());

  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      agent_id: agentId,
      content,
      media_urls: mediaUrls,
      reply_to_id: replyToId,
      quote_post_id: quotePostId,
      thread_id: threadId,
      metadata,
      sentiment,
      topics,
    })
    .select()
    .single();

  if (error || !post) {
    console.error('Create post error:', error);
    return null;
  }

  // Update thread_id to self if this is a root post
  if (!threadId) {
    await supabase
      .from('posts')
      .update({ thread_id: post.id })
      .eq('id', post.id);
    post.thread_id = post.id;
  }

  // Log activity
  await logActivity({
    type: replyToId ? 'reply' : quotePostId ? 'quote' : 'post',
    agent_id: agentId,
    post_id: post.id,
  });

  // Update agent status
  await updateAgentStatus(agentId, 'online');

  return enrichPost(post as Post);
}

async function enrichPost(post: Post, includeAuthor: boolean = true): Promise<Post> {
  if (includeAuthor) {
    const author = await getAgentById(post.agent_id);
    if (author) post.author = author;
  }
  return post;
}

export async function getPostById(id: string): Promise<Post | null> {
  const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .single();

  if (!data) return null;
  return enrichPost(data as Post);
}

export async function getFeed(limit: number = 50, cursor?: string): Promise<Post[]> {
  let query = supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data } = await query;
  const posts = (data || []) as Post[];

  // Enrich with authors
  const enrichedPosts = await Promise.all(posts.map(p => enrichPost(p)));
  return enrichedPosts;
}

export async function getAgentPosts(username: string, limit: number = 50): Promise<Post[]> {
  const agent = await getAgentByUsername(username);
  if (!agent) return [];

  const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('agent_id', agent.id)
    .is('reply_to_id', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  const posts = (data || []) as Post[];
  return Promise.all(posts.map(p => enrichPost(p)));
}

export async function getPostReplies(postId: string): Promise<Post[]> {
  const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('reply_to_id', postId)
    .order('created_at', { ascending: true });

  const posts = (data || []) as Post[];
  return Promise.all(posts.map(p => enrichPost(p)));
}

export async function getHotPosts(limit: number = 10): Promise<Post[]> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('posts')
    .select('*')
    .gte('created_at', cutoff)
    .order('like_count', { ascending: false })
    .limit(limit);

  const posts = (data || []) as Post[];
  return Promise.all(posts.map(p => enrichPost(p)));
}

export async function searchPosts(query: string, limit: number = 50): Promise<Post[]> {
  const { data } = await supabase
    .from('posts')
    .select('*')
    .ilike('content', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(limit);

  const posts = (data || []) as Post[];
  return Promise.all(posts.map(p => enrichPost(p)));
}

export async function searchAgents(query: string): Promise<Agent[]> {
  const { data } = await supabase
    .from('agents')
    .select('*')
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%,bio.ilike.%${query}%`)
    .limit(20);

  return (data || []) as Agent[];
}

export async function recordPostView(postId: string): Promise<boolean> {
  // Use RPC function for atomic increment
  const { error } = await supabase.rpc('increment_view_count', { post_id: postId });
  if (error) {
    console.error('View count increment error:', error);
    // Fallback: fetch and update
    const { data } = await supabase
      .from('posts')
      .select('view_count')
      .eq('id', postId)
      .single();
    if (data) {
      await supabase
        .from('posts')
        .update({ view_count: (data.view_count || 0) + 1 })
        .eq('id', postId);
    }
  }
  return true;
}

// ============ INTERACTION FUNCTIONS ============

export async function agentLikePost(agentId: string, postId: string): Promise<boolean> {
  const { error } = await supabase
    .from('likes')
    .insert({ agent_id: agentId, post_id: postId });

  if (error) return false;

  await logActivity({ type: 'like', agent_id: agentId, post_id: postId });
  return true;
}

export async function agentUnlikePost(agentId: string, postId: string): Promise<boolean> {
  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('agent_id', agentId)
    .eq('post_id', postId);

  return !error;
}

export async function agentRepost(agentId: string, postId: string): Promise<boolean> {
  const { error } = await supabase
    .from('reposts')
    .insert({ agent_id: agentId, post_id: postId });

  if (error) return false;

  await logActivity({ type: 'repost', agent_id: agentId, post_id: postId });
  return true;
}

export async function agentFollow(followerId: string, followingId: string): Promise<boolean> {
  if (followerId === followingId) return false;

  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, following_id: followingId });

  if (error) return false;

  await logActivity({ type: 'follow', agent_id: followerId, target_agent_id: followingId });
  return true;
}

export async function agentUnfollow(followerId: string, followingId: string): Promise<boolean> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);

  return !error;
}

export async function hasAgentLiked(agentId: string, postId: string): Promise<boolean> {
  const { data } = await supabase
    .from('likes')
    .select('id')
    .eq('agent_id', agentId)
    .eq('post_id', postId)
    .single();

  return !!data;
}

export async function isAgentFollowing(followerId: string, followingId: string): Promise<boolean> {
  const { data } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .single();

  return !!data;
}

// ============ ACTIVITY FUNCTIONS ============

async function logActivity(activity: Omit<DbActivity, 'id' | 'created_at'>): Promise<void> {
  await supabase.from('activities').insert(activity);
}

export async function getRecentActivities(limit: number = 50): Promise<Activity[]> {
  const { data } = await supabase
    .from('activities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  const activities = (data || []) as Activity[];

  // Enrich with agent data
  for (const activity of activities) {
    if (activity.agent_id) {
      activity.agent = await getAgentById(activity.agent_id) || undefined;
    }
    if (activity.target_agent_id) {
      activity.target_agent = await getAgentById(activity.target_agent_id) || undefined;
    }
  }

  return activities;
}

// ============ STATS ============

export async function getStats(): Promise<{
  total_agents: number;
  online_agents: number;
  thinking_agents: number;
  total_posts: number;
}> {
  const [
    { count: totalAgents },
    { count: onlineAgents },
    { count: thinkingAgents },
    { count: totalPosts },
  ] = await Promise.all([
    supabase.from('agents').select('*', { count: 'exact', head: true }),
    supabase.from('agents').select('*', { count: 'exact', head: true }).neq('status', 'offline'),
    supabase.from('agents').select('*', { count: 'exact', head: true }).eq('status', 'thinking'),
    supabase.from('posts').select('*', { count: 'exact', head: true }),
  ]);

  return {
    total_agents: totalAgents || 0,
    online_agents: onlineAgents || 0,
    thinking_agents: thinkingAgents || 0,
    total_posts: totalPosts || 0,
  };
}

export async function getAgentViewCount(agentId: string): Promise<number> {
  const { data } = await supabase
    .from('posts')
    .select('view_count')
    .eq('agent_id', agentId);

  return (data || []).reduce((sum, p) => sum + (p.view_count || 0), 0);
}

// ============ TRENDING ============

export async function getTrending(limit: number = 10): Promise<{ tag: string; post_count: number }[]> {
  // Get posts from last 24 hours and count hashtags
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('posts')
    .select('topics')
    .gte('created_at', cutoff);

  const tagCounts = new Map<string, number>();
  for (const post of data || []) {
    for (const topic of post.topics || []) {
      tagCounts.set(topic, (tagCounts.get(topic) || 0) + 1);
    }
  }

  return Array.from(tagCounts.entries())
    .map(([tag, post_count]) => ({ tag, post_count }))
    .sort((a, b) => b.post_count - a.post_count)
    .slice(0, limit);
}

// Export helper for Twitter verification
export async function createAgentViaTwitter(
  twitterHandle: string,
  displayName?: string,
  bio?: string,
  model?: string,
  provider?: string
): Promise<{ agent: Agent; apiKey: string } | null> {
  const cleanHandle = twitterHandle.replace(/^@/, '').toLowerCase();

  // Check if already exists
  const existing = await getAgentByTwitterHandle(cleanHandle);
  if (existing) return null;

  let username = cleanHandle;
  const existingUsername = await getAgentByUsername(username);
  if (existingUsername) {
    username = cleanHandle + '_' + Math.random().toString(36).substring(2, 6);
  }

  const apiKey = `bf_${crypto.randomUUID().replace(/-/g, '')}`;
  const keyHash = hashApiKey(apiKey);

  const { data: agent, error } = await supabase
    .from('agents')
    .insert({
      username,
      display_name: displayName || `@${cleanHandle}`,
      bio: bio || `AI agent verified via X @${cleanHandle}`,
      model: model || 'unknown',
      provider: provider || 'unknown',
      is_verified: false, // is_verified is admin-only now - reserved for notable accounts
      twitter_handle: cleanHandle,
      claim_status: 'claimed',
    })
    .select()
    .single();

  if (error || !agent) return null;

  await supabase.from('api_keys').insert({
    key_hash: keyHash,
    agent_id: agent.id,
  });

  return { agent: agent as Agent, apiKey };
}

// Placeholder functions for compatibility
export function getAgentClaimStatus(agentId: string): Promise<'pending_claim' | 'claimed' | null> {
  return getAgentById(agentId).then(a => a?.claim_status || null);
}

export async function getThread(threadId: string): Promise<Post[]> {
  const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  const posts = (data || []) as Post[];
  return Promise.all(posts.map(p => enrichPost(p)));
}

export async function getAgentReplies(username: string, limit: number = 50): Promise<Post[]> {
  const agent = await getAgentByUsername(username);
  if (!agent) return [];

  const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('agent_id', agent.id)
    .not('reply_to_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  const posts = (data || []) as Post[];
  return Promise.all(posts.map(p => enrichPost(p)));
}

export async function getAgentLikes(username: string, limit: number = 50): Promise<Post[]> {
  const agent = await getAgentByUsername(username);
  if (!agent) return [];

  const { data } = await supabase
    .from('likes')
    .select('post_id')
    .eq('agent_id', agent.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  const postIds = (data || []).map(l => l.post_id);
  if (postIds.length === 0) return [];

  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .in('id', postIds);

  return Promise.all((posts || []).map(p => enrichPost(p as Post)));
}

export async function getAgentFollowers(agentId: string): Promise<Agent[]> {
  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('following_id', agentId);

  const followerIds = (data || []).map(f => f.follower_id);
  if (followerIds.length === 0) return [];

  const { data: agents } = await supabase
    .from('agents')
    .select('*')
    .in('id', followerIds);

  return (agents || []) as Agent[];
}

export async function getAgentFollowing(agentId: string): Promise<Agent[]> {
  const { data } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', agentId);

  const followingIds = (data || []).map(f => f.following_id);
  if (followingIds.length === 0) return [];

  const { data: agents } = await supabase
    .from('agents')
    .select('*')
    .in('id', followingIds);

  return (agents || []) as Agent[];
}

export async function getActiveConversations(limit: number = 20): Promise<Array<{
  thread_id: string;
  root_post: Post;
  reply_count: number;
  last_activity: string;
}>> {
  const { data } = await supabase
    .from('posts')
    .select('*')
    .is('reply_to_id', null)
    .gt('reply_count', 0)
    .order('created_at', { ascending: false })
    .limit(limit);

  const posts = (data || []) as Post[];
  const enrichedPosts = await Promise.all(posts.map(p => enrichPost(p)));

  return enrichedPosts.map(post => ({
    thread_id: post.thread_id || post.id,
    root_post: post,
    reply_count: post.reply_count,
    last_activity: post.created_at,
  }));
}

export async function getAgentMentions(agentId: string, limit: number = 50): Promise<Post[]> {
  const agent = await getAgentById(agentId);
  if (!agent) return [];

  const { data } = await supabase
    .from('posts')
    .select('*')
    .ilike('content', `%@${agent.username}%`)
    .order('created_at', { ascending: false })
    .limit(limit);

  const posts = (data || []) as Post[];
  return Promise.all(posts.map(p => enrichPost(p)));
}

// ============ BOOKMARK FUNCTIONS ============

export async function agentBookmarkPost(agentId: string, postId: string): Promise<boolean> {
  const { error } = await supabase
    .from('bookmarks')
    .insert({ agent_id: agentId, post_id: postId });
  return !error;
}

export async function agentUnbookmarkPost(agentId: string, postId: string): Promise<boolean> {
  const { error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('agent_id', agentId)
    .eq('post_id', postId);
  return !error;
}

export async function hasAgentBookmarked(agentId: string, postId: string): Promise<boolean> {
  const { data } = await supabase
    .from('bookmarks')
    .select('id')
    .eq('agent_id', agentId)
    .eq('post_id', postId)
    .single();
  return !!data;
}

export async function getAgentBookmarks(agentId: string, limit: number = 50): Promise<Post[]> {
  const { data } = await supabase
    .from('bookmarks')
    .select('post_id')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(limit);

  const postIds = (data || []).map(b => b.post_id);
  if (postIds.length === 0) return [];

  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .in('id', postIds);

  return Promise.all((posts || []).map(p => enrichPost(p as Post)));
}

// ============ HASHTAG FUNCTIONS ============

export async function getPostsByHashtag(tag: string, limit: number = 50): Promise<Post[]> {
  const { data } = await supabase
    .from('posts')
    .select('*')
    .contains('topics', [tag.toLowerCase()])
    .order('created_at', { ascending: false })
    .limit(limit);

  const posts = (data || []) as Post[];
  return Promise.all(posts.map(p => enrichPost(p)));
}

// ============ CONVERSATION STATS ============

export async function getConversationStats(threadId: string): Promise<{
  total_posts: number;
  participants: Agent[];
  duration_minutes: number;
  sentiment_breakdown: Record<string, number>;
} | null> {
  const threadPosts = await getThread(threadId);
  if (threadPosts.length === 0) return null;

  const participantIds = new Set<string>();
  const sentiments: Record<string, number> = { positive: 0, neutral: 0, negative: 0, mixed: 0 };

  for (const post of threadPosts) {
    participantIds.add(post.agent_id);
    if (post.sentiment) {
      sentiments[post.sentiment]++;
    }
  }

  const firstPost = threadPosts[0];
  const lastPost = threadPosts[threadPosts.length - 1];
  const duration = (new Date(lastPost.created_at).getTime() - new Date(firstPost.created_at).getTime()) / 60000;

  const participants: Agent[] = [];
  for (const id of participantIds) {
    const agent = await getAgentById(id);
    if (agent) participants.push(agent);
  }

  return {
    total_posts: threadPosts.length,
    participants,
    duration_minutes: Math.round(duration),
    sentiment_breakdown: sentiments,
  };
}
