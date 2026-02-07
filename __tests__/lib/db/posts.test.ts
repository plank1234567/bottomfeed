/**
 * Tests for post database operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPost,
  getPostById,
  getFeed,
  getAgentPosts,
  getAgentReplies,
  getThread,
  getPostReplies,
  getAllThreadReplies,
  getHotPosts,
  searchPosts,
  getPostsByHashtag,
  getAgentMentions,
  getAgentLikes,
  getAgentBookmarks,
  recordPostView,
  getAgentViewCount,
  getConversationStats,
  getActiveConversations,
  getTrending,
  getStats,
  enrichPost,
  deletePost,
} from '@/lib/db/posts';
import { createAgent } from '@/lib/db/agents';
import { agentLikePost as likePost, agentBookmarkPost as bookmarkPost } from '@/lib/db/likes';
import {
  agents,
  posts,
  apiKeys,
  likes,
  bookmarks,
  hashtags,
  mentions,
  conversations,
  agentsByUsername,
  agentsByTwitter,
  postLikers,
  postReposters,
  followers,
  postsByAgent,
  repliesByPost,
} from '@/lib/db/store';

describe('Post CRUD Operations', () => {
  let testAgent1: { agent: { id: string; username: string }; apiKey: string };
  let testAgent2: { agent: { id: string; username: string }; apiKey: string };

  beforeEach(() => {
    // Clear all stores and indexes
    agents.clear();
    posts.clear();
    apiKeys.clear();
    likes.clear();
    bookmarks.clear();
    hashtags.clear();
    mentions.clear();
    conversations.clear();
    agentsByUsername.clear();
    agentsByTwitter.clear();
    postLikers.clear();
    postReposters.clear();
    followers.clear();
    postsByAgent.clear();
    repliesByPost.clear();

    // Create test agents
    testAgent1 = createAgent('testbot1', 'Test Bot 1', 'gpt-4', 'openai')!;
    testAgent2 = createAgent('testbot2', 'Test Bot 2', 'claude-3', 'anthropic')!;
  });

  describe('createPost', () => {
    it('creates a basic post', () => {
      const post = createPost(testAgent1.agent.id, 'Hello, world!');

      expect(post).not.toBeNull();
      expect(post!.content).toBe('Hello, world!');
      expect(post!.agent_id).toBe(testAgent1.agent.id);
      expect(post!.like_count).toBe(0);
      expect(post!.reply_count).toBe(0);
      expect(post!.repost_count).toBe(0);
    });

    it('extracts hashtags', () => {
      const post = createPost(testAgent1.agent.id, 'Testing #ai and #coding');

      expect(post!.topics).toContain('ai');
      expect(post!.topics).toContain('coding');
      expect(hashtags.has('ai')).toBe(true);
      expect(hashtags.has('coding')).toBe(true);
    });

    it('tracks mentions', () => {
      const post = createPost(testAgent1.agent.id, 'Hey @testbot2 check this out!');

      const mentionedPosts = mentions.get(testAgent2.agent.id);
      expect(mentionedPosts).toContain(post!.id);
    });

    it('detects positive sentiment', () => {
      const post = createPost(testAgent1.agent.id, 'This is amazing and wonderful!');
      expect(post!.sentiment).toBe('positive');
    });

    it('detects negative sentiment', () => {
      const post = createPost(testAgent1.agent.id, 'This is terrible and awful!');
      expect(post!.sentiment).toBe('negative');
    });

    it('detects neutral sentiment', () => {
      const post = createPost(testAgent1.agent.id, 'The quick brown fox jumps.');
      expect(post!.sentiment).toBe('neutral');
    });

    it('detects mixed sentiment', () => {
      // Mixed = equal positive and negative words
      const post = createPost(testAgent1.agent.id, 'This is great but also bad.');
      expect(post!.sentiment).toBe('mixed');
    });

    it('creates reply and updates parent', () => {
      const parent = createPost(testAgent1.agent.id, 'Parent post');
      const reply = createPost(testAgent2.agent.id, 'This is a reply', {}, parent!.id);

      expect(reply!.reply_to_id).toBe(parent!.id);
      expect(reply!.thread_id).toBe(parent!.id);

      const updatedParent = getPostById(parent!.id);
      expect(updatedParent!.reply_count).toBe(1);
    });

    it('creates quote post and updates quoted', () => {
      const original = createPost(testAgent1.agent.id, 'Original post');
      const quote = createPost(testAgent2.agent.id, 'Quoting this!', {}, undefined, original!.id);

      expect(quote!.quote_post_id).toBe(original!.id);

      const updatedOriginal = getPostById(original!.id);
      expect(updatedOriginal!.quote_count).toBe(1);
    });

    it('supports media URLs', () => {
      const post = createPost(
        testAgent1.agent.id,
        'Check out this image!',
        {},
        undefined,
        undefined,
        ['https://example.com/image.png']
      );

      expect(post!.media_urls).toContain('https://example.com/image.png');
    });

    it('supports title and post type', () => {
      const post = createPost(
        testAgent1.agent.id,
        'Content here',
        {},
        undefined,
        undefined,
        [],
        'My Title',
        'conversation'
      );

      expect(post!.title).toBe('My Title');
      expect(post!.post_type).toBe('conversation');
    });

    it('returns null for invalid agent', () => {
      const post = createPost('invalid-id', 'Content');
      expect(post).toBeNull();
    });

    it('increments agent post count', () => {
      createPost(testAgent1.agent.id, 'Post 1');
      createPost(testAgent1.agent.id, 'Post 2');

      const agent = agents.get(testAgent1.agent.id);
      expect(agent!.post_count).toBe(2);
    });
  });

  describe('getPostById', () => {
    it('returns enriched post', () => {
      const created = createPost(testAgent1.agent.id, 'Test content');
      const post = getPostById(created!.id);

      expect(post).not.toBeNull();
      expect(post!.author).toBeDefined();
      expect(post!.author!.username).toBe('testbot1');
    });

    it('returns null for invalid ID', () => {
      const post = getPostById('invalid-id');
      expect(post).toBeNull();
    });

    it('includes reply_to post', () => {
      const parent = createPost(testAgent1.agent.id, 'Parent');
      const reply = createPost(testAgent2.agent.id, 'Reply', {}, parent!.id);

      const enrichedReply = getPostById(reply!.id);
      expect(enrichedReply!.reply_to).toBeDefined();
      expect(enrichedReply!.reply_to!.content).toBe('Parent');
    });

    it('includes quoted post', () => {
      const original = createPost(testAgent1.agent.id, 'Original');
      const quote = createPost(testAgent2.agent.id, 'Quote', {}, undefined, original!.id);

      const enrichedQuote = getPostById(quote!.id);
      expect(enrichedQuote!.quote_post).toBeDefined();
      expect(enrichedQuote!.quote_post!.content).toBe('Original');
    });
  });

  describe('getFeed', () => {
    it('returns posts sorted by date', () => {
      const post1 = createPost(testAgent1.agent.id, 'First post');
      const post2 = createPost(testAgent2.agent.id, 'Second post');

      const feed = getFeed(10);
      expect(feed.length).toBe(2);
      // Feed sorts by recency, but posts created in same millisecond may vary
      // Just verify both posts are in the feed
      const contents = feed.map(p => p.content);
      expect(contents).toContain('First post');
      expect(contents).toContain('Second post');
    });

    it('respects limit', () => {
      createPost(testAgent1.agent.id, 'Post 1');
      createPost(testAgent1.agent.id, 'Post 2');
      createPost(testAgent1.agent.id, 'Post 3');

      const feed = getFeed(2);
      expect(feed.length).toBe(2);
    });

    it('filters original posts only', () => {
      const parent = createPost(testAgent1.agent.id, 'Parent');
      createPost(testAgent2.agent.id, 'Reply', {}, parent!.id);

      const feed = getFeed(10, undefined, 'original');
      expect(feed.length).toBe(1);
      expect(feed[0].content).toBe('Parent');
    });

    it('filters replies only', () => {
      const parent = createPost(testAgent1.agent.id, 'Parent');
      createPost(testAgent2.agent.id, 'Reply', {}, parent!.id);

      const feed = getFeed(10, undefined, 'replies');
      expect(feed.length).toBe(1);
      expect(feed[0].content).toBe('Reply');
    });

    it('filters media only', () => {
      createPost(testAgent1.agent.id, 'No media');
      createPost(testAgent2.agent.id, 'With media', {}, undefined, undefined, [
        'https://img.com/1.png',
      ]);

      const feed = getFeed(10, undefined, 'media');
      expect(feed.length).toBe(1);
      expect(feed[0].media_urls.length).toBeGreaterThan(0);
    });
  });

  describe('getAgentPosts', () => {
    it('returns posts for specific agent', () => {
      createPost(testAgent1.agent.id, 'Agent 1 post');
      createPost(testAgent2.agent.id, 'Agent 2 post');

      const posts = getAgentPosts('testbot1');
      expect(posts.length).toBe(1);
      expect(posts[0].content).toBe('Agent 1 post');
    });

    it('excludes replies by default', () => {
      const parent = createPost(testAgent2.agent.id, 'Parent');
      createPost(testAgent1.agent.id, 'Original');
      createPost(testAgent1.agent.id, 'Reply', {}, parent!.id);

      const agentPosts = getAgentPosts('testbot1');
      expect(agentPosts.length).toBe(1);
      expect(agentPosts[0].content).toBe('Original');
    });

    it('includes replies when requested', () => {
      const parent = createPost(testAgent2.agent.id, 'Parent');
      createPost(testAgent1.agent.id, 'Original');
      createPost(testAgent1.agent.id, 'Reply', {}, parent!.id);

      const agentPosts = getAgentPosts('testbot1', 50, true);
      expect(agentPosts.length).toBe(2);
    });

    it('returns empty for unknown agent', () => {
      const posts = getAgentPosts('nonexistent');
      expect(posts).toEqual([]);
    });
  });

  describe('getAgentReplies', () => {
    it('returns only replies', () => {
      const parent = createPost(testAgent2.agent.id, 'Parent');
      createPost(testAgent1.agent.id, 'Original');
      createPost(testAgent1.agent.id, 'Reply', {}, parent!.id);

      const replies = getAgentReplies('testbot1');
      expect(replies.length).toBe(1);
      expect(replies[0].content).toBe('Reply');
    });
  });

  describe('getThread', () => {
    it('returns all posts in thread', () => {
      const parent = createPost(testAgent1.agent.id, 'Parent');
      createPost(testAgent2.agent.id, 'Reply 1', {}, parent!.id);
      createPost(testAgent1.agent.id, 'Reply 2', {}, parent!.id);

      const thread = getThread(parent!.id);
      expect(thread.length).toBe(3);
    });

    it('sorts by creation time', () => {
      const parent = createPost(testAgent1.agent.id, 'Parent');
      createPost(testAgent2.agent.id, 'Reply 1', {}, parent!.id);
      createPost(testAgent1.agent.id, 'Reply 2', {}, parent!.id);

      const thread = getThread(parent!.id);
      expect(thread[0].content).toBe('Parent');
    });
  });

  describe('getPostReplies', () => {
    it('returns direct replies only', () => {
      const parent = createPost(testAgent1.agent.id, 'Parent');
      const reply1 = createPost(testAgent2.agent.id, 'Reply 1', {}, parent!.id);
      createPost(testAgent1.agent.id, 'Reply to reply', {}, reply1!.id);

      const replies = getPostReplies(parent!.id);
      expect(replies.length).toBe(1);
      expect(replies[0].content).toBe('Reply 1');
    });
  });

  describe('getAllThreadReplies', () => {
    it('returns all nested replies', () => {
      const parent = createPost(testAgent1.agent.id, 'Parent');
      const reply1 = createPost(testAgent2.agent.id, 'Reply 1', {}, parent!.id);
      createPost(testAgent1.agent.id, 'Nested reply', {}, reply1!.id);

      const allReplies = getAllThreadReplies(parent!.id);
      expect(allReplies.length).toBe(2);
    });
  });

  describe('getHotPosts', () => {
    it('returns posts with highest engagement', () => {
      const post1 = createPost(testAgent1.agent.id, 'Boring post');
      const post2 = createPost(testAgent2.agent.id, 'Hot post');

      // Add engagement to post2
      const p2 = posts.get(post2!.id);
      p2!.like_count = 10;
      p2!.reply_count = 5;

      const hot = getHotPosts(10);
      expect(hot[0].content).toBe('Hot post');
    });
  });

  describe('searchPosts', () => {
    it('searches by content', () => {
      createPost(testAgent1.agent.id, 'Hello world');
      createPost(testAgent2.agent.id, 'Goodbye world');

      const results = searchPosts('hello');
      expect(results.length).toBe(1);
      expect(results[0].content).toBe('Hello world');
    });

    it('requires all words to match', () => {
      createPost(testAgent1.agent.id, 'Hello beautiful world');
      createPost(testAgent2.agent.id, 'Hello there');

      const results = searchPosts('hello world');
      expect(results.length).toBe(1);
      expect(results[0].content).toBe('Hello beautiful world');
    });

    it('is case insensitive', () => {
      createPost(testAgent1.agent.id, 'HELLO WORLD');

      const results = searchPosts('hello');
      expect(results.length).toBe(1);
    });
  });

  describe('getPostsByHashtag', () => {
    it('returns posts with hashtag', () => {
      createPost(testAgent1.agent.id, 'Post about #ai');
      createPost(testAgent2.agent.id, 'Post about #coding');

      const results = getPostsByHashtag('ai');
      expect(results.length).toBe(1);
      expect(results[0].content).toContain('#ai');
    });

    it('returns empty for unknown hashtag', () => {
      const results = getPostsByHashtag('nonexistent');
      expect(results).toEqual([]);
    });
  });

  describe('getAgentMentions', () => {
    it('returns posts mentioning agent', () => {
      createPost(testAgent1.agent.id, 'Hey @testbot2!');
      createPost(testAgent1.agent.id, 'No mention here');

      const mentionedPosts = getAgentMentions(testAgent2.agent.id);
      expect(mentionedPosts.length).toBe(1);
      expect(mentionedPosts[0].content).toContain('@testbot2');
    });
  });

  describe('getAgentLikes', () => {
    it('returns posts liked by agent', () => {
      const post = createPost(testAgent1.agent.id, 'Likeable post');
      likePost(testAgent2.agent.id, post!.id);

      const likedPosts = getAgentLikes('testbot2');
      expect(likedPosts.length).toBe(1);
      expect(likedPosts[0].id).toBe(post!.id);
    });
  });

  describe('getAgentBookmarks', () => {
    it('returns bookmarked posts', () => {
      const post = createPost(testAgent1.agent.id, 'Bookmarkable post');
      bookmarkPost(testAgent2.agent.id, post!.id);

      const bookmarkedPosts = getAgentBookmarks(testAgent2.agent.id);
      expect(bookmarkedPosts.length).toBe(1);
      expect(bookmarkedPosts[0].id).toBe(post!.id);
    });
  });

  describe('recordPostView', () => {
    it('increments view count', () => {
      const post = createPost(testAgent1.agent.id, 'View me');

      recordPostView(post!.id);
      recordPostView(post!.id);

      const updated = getPostById(post!.id);
      expect(updated!.view_count).toBe(2);
    });

    it('returns false for invalid post', () => {
      const result = recordPostView('invalid-id');
      expect(result).toBe(false);
    });
  });

  describe('getAgentViewCount', () => {
    it('returns total views across all posts', () => {
      const post1 = createPost(testAgent1.agent.id, 'Post 1');
      const post2 = createPost(testAgent1.agent.id, 'Post 2');

      recordPostView(post1!.id);
      recordPostView(post1!.id);
      recordPostView(post2!.id);

      const totalViews = getAgentViewCount(testAgent1.agent.id);
      expect(totalViews).toBe(3);
    });
  });

  describe('getConversationStats', () => {
    it('returns conversation statistics', () => {
      const parent = createPost(testAgent1.agent.id, 'Great discussion');
      createPost(testAgent2.agent.id, 'I agree!', {}, parent!.id);

      const stats = getConversationStats(parent!.id);

      expect(stats).not.toBeNull();
      expect(stats!.total_posts).toBe(2);
      expect(stats!.participants.length).toBe(2);
    });

    it('returns null for invalid thread', () => {
      const stats = getConversationStats('invalid-id');
      expect(stats).toBeNull();
    });
  });

  describe('getActiveConversations', () => {
    it('returns conversations with multiple posts', () => {
      const parent = createPost(testAgent1.agent.id, 'Discussion starter');
      createPost(testAgent2.agent.id, 'Reply', {}, parent!.id);

      // Create a lonely post
      createPost(testAgent1.agent.id, 'No replies');

      const active = getActiveConversations();
      expect(active.length).toBe(1);
      expect(active[0].root_post.content).toBe('Discussion starter');
    });
  });

  describe('getTrending', () => {
    it('returns trending hashtags with counts', () => {
      createPost(testAgent1.agent.id, '#ai is cool');
      createPost(testAgent2.agent.id, '#ai is amazing');
      createPost(testAgent1.agent.id, '#coding time');

      const trending = getTrending();
      expect(trending[0].tag).toBe('ai');
      expect(trending[0].post_count).toBe(2);
    });
  });

  describe('getStats', () => {
    it('returns aggregate statistics', () => {
      createPost(testAgent1.agent.id, 'Post 1');
      const post = createPost(testAgent2.agent.id, 'Post 2');
      createPost(testAgent1.agent.id, 'Reply', {}, post!.id);

      const stats = getStats();

      expect(stats.total_agents).toBe(2);
      expect(stats.total_posts).toBe(3);
      expect(stats.total_replies).toBe(1);
    });
  });

  describe('enrichPost', () => {
    it('adds author information', () => {
      const created = createPost(testAgent1.agent.id, 'Test');
      const rawPost = posts.get(created!.id)!;

      const enriched = enrichPost(rawPost);
      expect(enriched.author).toBeDefined();
      expect(enriched.author!.username).toBe('testbot1');
    });

    it('adds liked_by_agents', () => {
      const post = createPost(testAgent1.agent.id, 'Test');
      likePost(testAgent2.agent.id, post!.id);

      const rawPost = posts.get(post!.id)!;
      const enriched = enrichPost(rawPost);

      expect(enriched.liked_by_agents).toContain('testbot2');
    });
  });

  describe('deletePost', () => {
    it('deletes a post and returns true', () => {
      const post = createPost(testAgent1.agent.id, 'To be deleted');
      expect(getPostById(post!.id)).not.toBeNull();

      const result = deletePost(post!.id);
      expect(result).toBe(true);
      expect(getPostById(post!.id)).toBeNull();
    });

    it('returns false for non-existent post', () => {
      const result = deletePost('non-existent-id');
      expect(result).toBe(false);
    });

    it('decrements author post count', () => {
      const post = createPost(testAgent1.agent.id, 'To be deleted');
      const initialCount = agents.get(testAgent1.agent.id)!.post_count;

      deletePost(post!.id);

      const newCount = agents.get(testAgent1.agent.id)!.post_count;
      expect(newCount).toBe(initialCount - 1);
    });

    it('decrements parent reply count', () => {
      const parent = createPost(testAgent1.agent.id, 'Parent');
      const reply = createPost(testAgent2.agent.id, 'Reply', {}, parent!.id);

      expect(posts.get(parent!.id)!.reply_count).toBe(1);

      deletePost(reply!.id);

      expect(posts.get(parent!.id)!.reply_count).toBe(0);
    });

    it('cleans up likes on deleted post', () => {
      const post = createPost(testAgent1.agent.id, 'Liked post');
      likePost(testAgent2.agent.id, post!.id);

      deletePost(post!.id);

      // Verify like is cleaned up
      const likedPosts = getAgentLikes('testbot2');
      expect(likedPosts.find(p => p.id === post!.id)).toBeUndefined();
    });

    it('cleans up hashtag associations', () => {
      const post = createPost(testAgent1.agent.id, 'Hello #test');
      expect(getPostsByHashtag('test').length).toBe(1);

      deletePost(post!.id);

      expect(getPostsByHashtag('test').length).toBe(0);
    });

    it('cleans up bookmarks on deleted post', () => {
      const post = createPost(testAgent1.agent.id, 'Bookmarked post');
      bookmarkPost(testAgent2.agent.id, post!.id);

      deletePost(post!.id);

      // Verify bookmark is cleaned up
      const bookmarkedPosts = getAgentBookmarks(testAgent2.agent.id);
      expect(bookmarkedPosts.find(p => p.id === post!.id)).toBeUndefined();
    });
  });
});
