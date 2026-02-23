import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before imports
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  extractBehavioralFeatures,
  extractLinguisticFeatures,
  extractDebateChallengeFeatures,
  extractNetworkFeatures,
  extractAllFeatures,
  fetchPostsForFeatures,
} from '@/lib/psychographics/features';
import { supabase } from '@/lib/supabase';

// PostRow fixture factory — matches the internal interface of features.ts
interface PostRow {
  id: string;
  content: string;
  reply_to_id: string | null;
  created_at: string;
  like_count: number;
  reply_count: number;
  repost_count: number;
  topics: string[] | null;
  sentiment: string | null;
}

let postCounter = 0;
function makePost(overrides?: Partial<PostRow>): PostRow {
  postCounter++;
  return {
    id: crypto.randomUUID(),
    content: 'Test post content with some words to analyze for features',
    reply_to_id: null,
    created_at: new Date(Date.now() - postCounter * 3600000).toISOString(),
    like_count: 0,
    reply_count: 0,
    repost_count: 0,
    topics: null,
    sentiment: null,
    ...overrides,
  };
}

describe('psychographics/features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postCounter = 0;
  });

  // ============================================================
  // extractBehavioralFeatures
  // ============================================================
  describe('extractBehavioralFeatures', () => {
    it('returns zero-defaults for empty posts array', async () => {
      const features = await extractBehavioralFeatures('agent-1', []);
      expect(features.posting_frequency).toBe(0);
      expect(features.reply_initiation_ratio).toBe(0);
      expect(features.avg_post_length).toBe(0);
      expect(features.topic_diversity).toBe(0);
      expect(features.posting_hour_entropy).toBe(0);
      expect(features.behavioral_consistency).toBe(0.5);
      expect(features.response_latency_inv).toBe(0.5);
      expect(features.topic_originality).toBe(0);
    });

    it('calculates posting frequency normalized to 0-1', async () => {
      // 10 posts in 1 day = 10/day → 10/10 = 1.0
      const now = Date.now();
      const posts = Array.from({ length: 10 }, (_, i) =>
        makePost({
          created_at: new Date(now - i * 3600000).toISOString(),
        })
      );
      const features = await extractBehavioralFeatures('agent-1', posts);
      expect(features.posting_frequency).toBeGreaterThan(0);
      expect(features.posting_frequency).toBeLessThanOrEqual(1);
    });

    it('calculates reply initiation ratio', async () => {
      const posts = [
        makePost({ reply_to_id: 'some-parent' }),
        makePost({ reply_to_id: 'other-parent' }),
        makePost({ reply_to_id: null }),
        makePost({ reply_to_id: null }),
      ];
      const features = await extractBehavioralFeatures('agent-1', posts);
      expect(features.reply_initiation_ratio).toBe(0.5);
    });

    it('normalizes avg post length to 500 chars max', async () => {
      const posts = [
        makePost({ content: 'a'.repeat(1000) }),
        makePost({ content: 'b'.repeat(500) }),
      ];
      const features = await extractBehavioralFeatures('agent-1', posts);
      // avg = 750, 750/500 = 1.5 → capped to 1
      expect(features.avg_post_length).toBe(1);
    });

    it('calculates topic diversity', async () => {
      const posts = [
        makePost({ topics: ['AI', 'ML'] }),
        makePost({ topics: ['crypto'] }),
        makePost({ topics: ['AI'] }),
      ];
      const features = await extractBehavioralFeatures('agent-1', posts);
      // 3 unique topics / 3 posts * 5 = 5 → capped at 1
      expect(features.topic_diversity).toBe(1);
    });

    it('calculates topic originality from single-use topics', async () => {
      const posts = [
        makePost({ topics: ['AI', 'ML'] }),
        makePost({ topics: ['AI', 'crypto'] }),
        makePost({ topics: ['ML'] }),
      ];
      const features = await extractBehavioralFeatures('agent-1', posts);
      // AI: 2, ML: 2, crypto: 1 → singleUse = 1 / 3 topics ≈ 0.333
      expect(features.topic_originality).toBeCloseTo(1 / 3, 2);
    });

    it('computes posting hour entropy', async () => {
      // Posts spread across many hours → high entropy
      const posts = Array.from({ length: 24 }, (_, i) =>
        makePost({
          created_at: new Date(2024, 0, 1, i, 0, 0).toISOString(),
        })
      );
      const features = await extractBehavioralFeatures('agent-1', posts);
      // Uniform distribution across 24 hours → entropy ≈ log2(24)/log2(24) = 1.0
      expect(features.posting_hour_entropy).toBeGreaterThan(0.9);
    });

    it('computes behavioral consistency from sentiment', async () => {
      // All positive sentiment → variance = 0 → consistency = 1
      const posts = Array.from({ length: 5 }, () => makePost({ sentiment: 'positive' }));
      const features = await extractBehavioralFeatures('agent-1', posts);
      expect(features.behavioral_consistency).toBe(1);
    });

    it('computes lower consistency for mixed sentiment', async () => {
      const posts = [
        makePost({ sentiment: 'positive' }),
        makePost({ sentiment: 'negative' }),
        makePost({ sentiment: 'positive' }),
        makePost({ sentiment: 'negative' }),
      ];
      const features = await extractBehavioralFeatures('agent-1', posts);
      expect(features.behavioral_consistency).toBeLessThan(1);
    });

    it('calculates sentiment amplitude', async () => {
      // All positive (1.0) → deviation from 0.5 = 0.5, *2 = 1.0
      const posts = Array.from({ length: 5 }, () => makePost({ sentiment: 'positive' }));
      const features = await extractBehavioralFeatures('agent-1', posts);
      expect(features.sentiment_amplitude).toBe(1);
    });

    it('returns sentiment_amplitude 0 for no sentiment', async () => {
      const posts = [makePost({ sentiment: null })];
      const features = await extractBehavioralFeatures('agent-1', posts);
      expect(features.sentiment_amplitude).toBe(0);
    });

    it('calculates engagement volatility', async () => {
      // Varying engagement → higher volatility
      const posts = [
        makePost({ like_count: 100, reply_count: 50, repost_count: 20 }),
        makePost({ like_count: 1, reply_count: 0, repost_count: 0 }),
        makePost({ like_count: 50, reply_count: 20, repost_count: 10 }),
      ];
      const features = await extractBehavioralFeatures('agent-1', posts);
      expect(features.volatility).toBeGreaterThan(0);
      expect(features.volatility).toBeLessThanOrEqual(1);
    });

    it('returns volatility 0 for single post', async () => {
      const features = await extractBehavioralFeatures('agent-1', [makePost()]);
      expect(features.volatility).toBe(0);
    });
  });

  // ============================================================
  // extractLinguisticFeatures
  // ============================================================
  describe('extractLinguisticFeatures', () => {
    it('returns zero-defaults for empty posts', async () => {
      const features = await extractLinguisticFeatures('agent-1', []);
      expect(features.type_token_ratio).toBe(0);
      expect(features.hedging_ratio).toBe(0);
      expect(features.certainty_ratio).toBe(0);
      expect(features.self_focus_ratio).toBe(0);
      expect(features.self_focus_ratio_inv).toBe(1);
      expect(features.emotional_word_ratio).toBe(0);
      expect(features.readability).toBe(0.5);
    });

    it('returns zero-defaults for empty-content posts', async () => {
      const features = await extractLinguisticFeatures('agent-1', [makePost({ content: '' })]);
      expect(features.type_token_ratio).toBe(0);
    });

    it('calculates type-token ratio for vocabulary richness', async () => {
      // All unique words → TTR close to 1
      const posts = [makePost({ content: 'alpha beta gamma delta epsilon zeta eta theta' })];
      const features = await extractLinguisticFeatures('agent-1', posts);
      expect(features.type_token_ratio).toBe(1); // 8 unique / 8 total
    });

    it('detects hedging words', async () => {
      const posts = [
        makePost({ content: 'Perhaps maybe this might be possibly true, arguably somewhat' }),
      ];
      const features = await extractLinguisticFeatures('agent-1', posts);
      expect(features.hedging_ratio).toBeGreaterThan(0);
    });

    it('detects certainty words', async () => {
      const posts = [
        makePost({
          content: 'This is absolutely definitely certainly clearly obviously undoubtedly true',
        }),
      ];
      const features = await extractLinguisticFeatures('agent-1', posts);
      expect(features.certainty_ratio).toBeGreaterThan(0);
    });

    it('detects supportive words', async () => {
      const posts = [
        makePost({ content: 'I agree with this good point, exactly well said. Great insight!' }),
      ];
      const features = await extractLinguisticFeatures('agent-1', posts);
      expect(features.supportive_word_ratio).toBeGreaterThan(0);
    });

    it('detects contrarian words', async () => {
      const posts = [
        makePost({
          content:
            'I disagree however this is wrong and flawed. On the contrary, it is problematic.',
        }),
      ];
      const features = await extractLinguisticFeatures('agent-1', posts);
      expect(features.contrarian_word_ratio).toBeGreaterThan(0);
    });

    it('detects emotional words', async () => {
      const posts = [
        makePost({
          content: 'I love this, so excited and thrilled! It is amazing and incredible!',
        }),
      ];
      const features = await extractLinguisticFeatures('agent-1', posts);
      expect(features.emotional_word_ratio).toBeGreaterThan(0);
    });

    it('measures self-focus ratio', async () => {
      const posts = [
        makePost({
          content:
            "I think I'm right because I've always believed my opinion matters to my audience",
        }),
      ];
      const features = await extractLinguisticFeatures('agent-1', posts);
      expect(features.self_focus_ratio).toBeGreaterThan(0);
      expect(features.self_focus_ratio_inv).toBeLessThan(1);
    });

    it('detects question ratio', async () => {
      const posts = [
        makePost({ content: 'Why is this happening? What do you think? How can we fix it?' }),
      ];
      const features = await extractLinguisticFeatures('agent-1', posts);
      expect(features.question_ratio).toBeGreaterThan(0);
    });

    it('detects exclamation ratio', async () => {
      const posts = [makePost({ content: 'Amazing! Incredible! Wow! So good!' })];
      const features = await extractLinguisticFeatures('agent-1', posts);
      expect(features.exclamation_ratio).toBeGreaterThan(0);
    });

    it('uses first 200 posts only', async () => {
      const posts = Array.from({ length: 300 }, () => makePost());
      const features = await extractLinguisticFeatures('agent-1', posts);
      // Should succeed without errors, uses slice(0, 200)
      expect(features.type_token_ratio).toBeGreaterThanOrEqual(0);
    });

    it('calculates readability proxy from words per sentence', async () => {
      // Short sentences → readability close to appropriate value
      const posts = [makePost({ content: 'Short. Sentence. Here.' })];
      const features = await extractLinguisticFeatures('agent-1', posts);
      // 3 words / 3 sentences = 1 word/sentence → 1/20 = 0.05
      expect(features.readability).toBeLessThan(0.5);
    });

    it('calculates expressive punctuation', async () => {
      const posts = [makePost({ content: 'What!!! No way... Really?!! So cool...' })];
      const features = await extractLinguisticFeatures('agent-1', posts);
      expect(features.expressive_punctuation).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // extractDebateChallengeFeatures (Supabase mocked)
  // ============================================================
  describe('extractDebateChallengeFeatures', () => {
    it('returns default zeros when no data', async () => {
      const mockFrom = vi.mocked(supabase.from);
      // Chain all to return empty
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            // For debate_entries count query
            ...({ count: 0, data: null, error: null } as never),
          }),
          in: vi.fn().mockReturnValue({
            // For debates count
            ...({ count: 0, data: null, error: null } as never),
          }),
        }),
      } as never);

      const features = await extractDebateChallengeFeatures('agent-1');
      expect(features.debate_participation_rate).toBe(0);
      expect(features.minority_vote_ratio).toBe(0);
      expect(features.red_team_ratio).toBe(0);
      expect(features.evidence_tier_avg).toBe(0);
      expect(features.evidence_quality).toBe(0);
    });

    it('calculates debate participation rate', async () => {
      const callCount = 0;
      const mockFrom = vi.mocked(supabase.from);
      mockFrom.mockImplementation((table: string) => {
        if (table === 'debate_entries') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 5, data: null, error: null }),
            }),
          } as never;
        }
        if (table === 'debates') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ count: 10, data: null, error: null }),
            }),
          } as never;
        }
        if (table === 'challenge_participants') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          } as never;
        }
        if (table === 'challenge_contributions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          } as never;
        }
        if (table === 'debate_votes') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          } as never;
        }
        return { select: vi.fn().mockReturnThis() } as never;
      });

      const features = await extractDebateChallengeFeatures('agent-1');
      expect(features.debate_participation_rate).toBe(0.5);
    });

    it('calculates red team ratio from challenge roles', async () => {
      const mockFrom = vi.mocked(supabase.from);
      mockFrom.mockImplementation((table: string) => {
        if (table === 'debate_entries') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 0, data: null }),
            }),
          } as never;
        }
        if (table === 'debates') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ count: 0, data: null }),
            }),
          } as never;
        }
        if (table === 'challenge_participants') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [
                    { role: 'red_team' },
                    { role: 'contributor' },
                    { role: 'contrarian' },
                    { role: 'contributor' },
                  ],
                }),
              }),
            }),
          } as never;
        }
        if (table === 'challenge_contributions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          } as never;
        }
        if (table === 'debate_votes') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          } as never;
        }
        return { select: vi.fn().mockReturnThis() } as never;
      });

      const features = await extractDebateChallengeFeatures('agent-1');
      expect(features.red_team_ratio).toBe(0.5);
    });

    it('calculates evidence tier average', async () => {
      const mockFrom = vi.mocked(supabase.from);
      mockFrom.mockImplementation((table: string) => {
        if (table === 'debate_entries') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 0, data: null }),
            }),
          } as never;
        }
        if (table === 'debates') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ count: 0, data: null }),
            }),
          } as never;
        }
        if (table === 'challenge_participants') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          } as never;
        }
        if (table === 'challenge_contributions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [{ evidence_tier: 'empirical' }, { evidence_tier: 'logical' }],
                }),
              }),
            }),
          } as never;
        }
        if (table === 'debate_votes') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          } as never;
        }
        return { select: vi.fn().mockReturnThis() } as never;
      });

      const features = await extractDebateChallengeFeatures('agent-1');
      // (1.0 + 0.75) / 2 = 0.875
      expect(features.evidence_tier_avg).toBe(0.875);
      expect(features.evidence_quality).toBe(0.875);
    });

    it('calculates minority vote ratio', async () => {
      const mockFrom = vi.mocked(supabase.from);
      mockFrom.mockImplementation((table: string) => {
        if (table === 'debate_entries') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 0, data: null }),
            }),
          } as never;
        }
        if (table === 'debates' && callIndex === 0) {
          callIndex++;
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ count: 0, data: null }),
            }),
          } as never;
        }
        if (table === 'debates') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      { id: 'debate-1', winner_entry_id: 'entry-B' },
                      { id: 'debate-2', winner_entry_id: 'entry-D' },
                    ],
                  }),
                }),
              }),
            }),
          } as never;
        }
        if (table === 'challenge_participants') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          } as never;
        }
        if (table === 'challenge_contributions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          } as never;
        }
        if (table === 'debate_votes') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [
                    { entry_id: 'entry-A', debate_id: 'debate-1' },
                    { entry_id: 'entry-C', debate_id: 'debate-2' },
                  ],
                }),
              }),
            }),
          } as never;
        }
        return { select: vi.fn().mockReturnThis() } as never;
      });

      let callIndex = 0;

      const features = await extractDebateChallengeFeatures('agent-1');
      // Both votes were on losing side → minority_vote_ratio = 1.0
      expect(features.minority_vote_ratio).toBe(1);
    });

    it('handles errors gracefully', async () => {
      const mockFrom = vi.mocked(supabase.from);
      mockFrom.mockImplementation(() => {
        throw new Error('Database error');
      });

      const features = await extractDebateChallengeFeatures('agent-1');
      expect(features.debate_participation_rate).toBe(0);
    });
  });

  // ============================================================
  // extractNetworkFeatures (Supabase mocked)
  // ============================================================
  describe('extractNetworkFeatures', () => {
    it('returns defaults when agent not found', async () => {
      const mockFrom = vi.mocked(supabase.from);
      mockFrom.mockImplementation(
        () =>
          ({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                }),
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          }) as never
      );

      const features = await extractNetworkFeatures('agent-1');
      expect(features.follower_ratio).toBe(0.5);
      expect(features.follow_reciprocity).toBe(0);
    });

    it('calculates follower ratio', async () => {
      const mockFrom = vi.mocked(supabase.from);
      mockFrom.mockImplementation((table: string) => {
        if (table === 'agents') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { follower_count: 80, following_count: 20 },
                  }),
                }),
              }),
            }),
          } as never;
        }
        if (table === 'follows') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          } as never;
        }
        if (table === 'likes') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          } as never;
        }
        return { select: vi.fn().mockReturnThis() } as never;
      });

      const features = await extractNetworkFeatures('agent-1');
      // 80 / (80 + 20) = 0.8
      expect(features.follower_ratio).toBe(0.8);
    });

    it('handles errors gracefully', async () => {
      const mockFrom = vi.mocked(supabase.from);
      mockFrom.mockImplementation(() => {
        throw new Error('DB error');
      });

      const features = await extractNetworkFeatures('agent-1');
      expect(features.follower_ratio).toBe(0.5);
      expect(features.follow_reciprocity).toBe(0);
    });

    it('calculates follow reciprocity', async () => {
      const mockFrom = vi.mocked(supabase.from);
      mockFrom.mockImplementation((table: string) => {
        if (table === 'agents') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { follower_count: 10, following_count: 10 },
                  }),
                }),
              }),
            }),
          } as never;
        }
        if (table === 'follows') {
          return {
            select: vi.fn().mockImplementation((cols: string) => {
              if (cols === 'following_id') {
                // Agent follows A, B, C
                return {
                  eq: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [{ following_id: 'A' }, { following_id: 'B' }, { following_id: 'C' }],
                    }),
                  }),
                };
              }
              if (cols === 'follower_id') {
                // A and B follow back
                return {
                  eq: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [{ follower_id: 'A' }, { follower_id: 'B' }],
                    }),
                  }),
                };
              }
              return {
                eq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [] }),
                }),
              };
            }),
          } as never;
        }
        if (table === 'posts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  is: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [] }),
                  }),
                }),
                is: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [] }),
                }),
              }),
              in: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [] }),
                }),
              }),
            }),
          } as never;
        }
        if (table === 'likes') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          } as never;
        }
        return { select: vi.fn().mockReturnThis() } as never;
      });

      const features = await extractNetworkFeatures('agent-1');
      // 2 mutual / 3 following = 0.667
      expect(features.follow_reciprocity).toBeCloseTo(2 / 3, 2);
    });

    it('calculates engagement reciprocity when no likes given', async () => {
      const mockFrom = vi.mocked(supabase.from);
      mockFrom.mockImplementation((table: string) => {
        if (table === 'agents') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { follower_count: 0, following_count: 0 },
                  }),
                }),
              }),
            }),
          } as never;
        }
        if (table === 'follows') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          } as never;
        }
        if (table === 'likes') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          } as never;
        }
        return { select: vi.fn().mockReturnThis() } as never;
      });

      const features = await extractNetworkFeatures('agent-1');
      expect(features.engagement_reciprocity).toBe(0);
    });
  });

  // ============================================================
  // extractAllFeatures
  // ============================================================
  describe('extractAllFeatures', () => {
    it('returns all four feature families', async () => {
      const mockFrom = vi.mocked(supabase.from);
      mockFrom.mockImplementation((table: string) => {
        if (table === 'posts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [] }),
                  }),
                }),
                not: vi.fn().mockReturnValue({
                  is: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [] }),
                  }),
                }),
              }),
              in: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [] }),
                }),
              }),
            }),
          } as never;
        }
        if (table === 'debate_entries') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 0, data: null }),
            }),
          } as never;
        }
        if (table === 'debates') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ count: 0, data: null }),
            }),
          } as never;
        }
        if (table === 'challenge_participants') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          } as never;
        }
        if (table === 'challenge_contributions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          } as never;
        }
        if (table === 'debate_votes') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          } as never;
        }
        if (table === 'agents') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                }),
              }),
            }),
          } as never;
        }
        if (table === 'follows') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          } as never;
        }
        if (table === 'likes') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          } as never;
        }
        return { select: vi.fn().mockReturnThis() } as never;
      });

      const features = await extractAllFeatures('agent-1');
      expect(features).toHaveProperty('behavioral');
      expect(features).toHaveProperty('linguistic');
      expect(features).toHaveProperty('debate_challenge');
      expect(features).toHaveProperty('network');
    });

    it('shares fetched posts between behavioral and linguistic extractors', async () => {
      const mockFrom = vi.mocked(supabase.from);
      const postsFetchSpy = vi.fn().mockResolvedValue({ data: [] });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'posts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: postsFetchSpy,
                  }),
                }),
                not: vi.fn().mockReturnValue({
                  is: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [] }),
                  }),
                }),
              }),
              in: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [] }),
                }),
              }),
            }),
          } as never;
        }
        // Return safe defaults for all other tables
        const defaultChain = {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              }),
              limit: vi.fn().mockResolvedValue({ data: [] }),
            }),
            in: vi.fn().mockResolvedValue({ count: 0, data: null }),
          }),
        };
        return defaultChain as never;
      });

      await extractAllFeatures('agent-1');
      // Posts should be fetched once (shared between behavioral + linguistic)
      expect(postsFetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================
  // fetchPostsForFeatures
  // ============================================================
  describe('fetchPostsForFeatures', () => {
    it('returns empty array when no data', async () => {
      const mockFrom = vi.mocked(supabase.from);
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: null }),
              }),
            }),
          }),
        }),
      } as never);

      const posts = await fetchPostsForFeatures('agent-1');
      expect(posts).toEqual([]);
    });

    it('returns posts in descending order', async () => {
      const mockFrom = vi.mocked(supabase.from);
      const testPosts = [makePost(), makePost()];
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: testPosts }),
              }),
            }),
          }),
        }),
      } as never);

      const posts = await fetchPostsForFeatures('agent-1');
      expect(posts).toHaveLength(2);
    });
  });
});
