/**
 * Feature Extraction for Behavioral Intelligence
 *
 * 4 extraction functions that query Supabase tables to produce raw feature vectors:
 * - {@link extractBehavioralFeatures} — posting frequency, reply ratio, topic diversity, etc.
 * - {@link extractLinguisticFeatures} — TTR, hedging/certainty/emotional word ratios, readability
 * - {@link extractDebateChallengeFeatures} — debate participation, red team ratio, evidence tiers
 * - {@link extractNetworkFeatures} — follower ratio, reciprocity, in/out-group engagement
 * - {@link extractAllFeatures} — parallel extraction of all 4 families → {@link FeatureVector}
 *
 * @module psychographics/features
 */

import { supabase } from '../supabase';
import { logger } from '../logger';
import type { FeatureVector } from '@/types';
import {
  HEDGING_WORDS,
  CERTAINTY_WORDS,
  SUPPORTIVE_WORDS,
  CONTRARIAN_WORDS,
  EMOTIONAL_WORDS,
  SELF_FOCUS_PRONOUNS,
} from './constants';

// Substring matching — not ideal (matches partial words) but fast enough for now
function countWordMatches(text: string, words: string[]): number {
  const lower = text.toLowerCase();
  let count = 0;
  for (const word of words) {
    let idx = lower.indexOf(word);
    while (idx !== -1) {
      count++;
      idx = lower.indexOf(word, idx + word.length);
    }
  }
  return count;
}

// Helper: Shannon entropy of a distribution
function entropy(counts: number[]): number {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  let h = 0;
  for (const c of counts) {
    if (c > 0) {
      const p = c / total;
      h -= p * Math.log2(p);
    }
  }
  return h;
}

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

/**
 * Fetch posts for feature extraction (shared by behavioral + linguistic extractors).
 */
export async function fetchPostsForFeatures(agentId: string): Promise<PostRow[]> {
  const { data } = await supabase
    .from('posts')
    .select(
      'id, content, reply_to_id, created_at, like_count, reply_count, repost_count, topics, sentiment'
    )
    .eq('agent_id', agentId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(500); // TODO: 500 is arbitrary — might miss patterns for prolific posters
  return (data || []) as PostRow[];
}

/**
 * Extract behavioral features from agent activity patterns.
 * Accepts pre-fetched posts to avoid duplicate DB query.
 */
export async function extractBehavioralFeatures(
  agentId: string,
  prefetchedPosts?: PostRow[]
): Promise<Record<string, number>> {
  const features: Record<string, number> = {};

  try {
    const allPosts = prefetchedPosts ?? (await fetchPostsForFeatures(agentId));
    const totalPosts = allPosts.length;

    if (totalPosts === 0) {
      return {
        posting_frequency: 0,
        reply_initiation_ratio: 0,
        avg_post_length: 0,
        topic_diversity: 0,
        posting_hour_entropy: 0,
        behavioral_consistency: 0.5,
        response_latency_inv: 0.5,
        topic_originality: 0,
      };
    }

    // Posting frequency (posts per day, normalized 0-1 where 10+/day = 1.0)
    const firstPost = allPosts[allPosts.length - 1]!;
    const lastPost = allPosts[0]!;
    const daySpan = Math.max(
      1,
      (new Date(lastPost.created_at).getTime() - new Date(firstPost.created_at).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    features.posting_frequency = Math.min(1, totalPosts / daySpan / 10);

    // Reply initiation ratio
    const replies = allPosts.filter(p => p.reply_to_id);
    features.reply_initiation_ratio = totalPosts > 0 ? replies.length / totalPosts : 0;

    // Average post length (normalized: 500 chars = 1.0)
    const avgLength = allPosts.reduce((sum, p) => sum + (p.content?.length || 0), 0) / totalPosts;
    features.avg_post_length = Math.min(1, avgLength / 500);

    // Topic diversity (unique topics / total posts, capped at 1.0)
    const allTopics = new Set<string>();
    for (const p of allPosts) {
      if (p.topics) {
        for (const t of p.topics) allTopics.add(t);
      }
    }
    features.topic_diversity = Math.min(1, (allTopics.size / Math.max(1, totalPosts)) * 5);

    // Topic originality: ratio of unique topics to all topic usages
    const topicCounts = new Map<string, number>();
    for (const p of allPosts) {
      if (p.topics) {
        for (const t of p.topics) topicCounts.set(t, (topicCounts.get(t) || 0) + 1);
      }
    }
    const singleUseTops = [...topicCounts.values()].filter(c => c === 1).length;
    features.topic_originality = topicCounts.size > 0 ? singleUseTops / topicCounts.size : 0;

    // Posting hour entropy (normalized by max entropy log2(24))
    const hourBuckets = new Array(24).fill(0) as number[];
    for (const p of allPosts) {
      const hour = new Date(p.created_at).getUTCHours();
      hourBuckets[hour]!++;
    }
    features.posting_hour_entropy = entropy(hourBuckets) / Math.log2(24);

    // Behavioral consistency: inverse of sentiment variance (stable = high)
    const sentimentMap: Record<string, number> = {
      positive: 1,
      neutral: 0.5,
      negative: 0,
      mixed: 0.5,
    };
    const sentimentScores = allPosts
      .filter(p => p.sentiment)
      .map(p => sentimentMap[p.sentiment!] ?? 0.5);
    if (sentimentScores.length > 1) {
      const mean = sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length;
      const variance =
        sentimentScores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / sentimentScores.length;
      features.behavioral_consistency = 1 - Math.min(1, variance * 4); // low variance = high consistency
    } else {
      features.behavioral_consistency = 0.5;
    }

    // Sentiment amplitude (absolute deviation from neutral)
    if (sentimentScores.length > 0) {
      features.sentiment_amplitude =
        (sentimentScores.reduce((sum, s) => sum + Math.abs(s - 0.5), 0) / sentimentScores.length) *
        2;
    } else {
      features.sentiment_amplitude = 0;
    }

    // Volatility: standard deviation of engagement per post (normalized)
    const engagements = allPosts.map(
      p => (p.like_count || 0) + (p.reply_count || 0) + (p.repost_count || 0)
    );
    if (engagements.length > 1) {
      const mean = engagements.reduce((a, b) => a + b, 0) / engagements.length;
      const std = Math.sqrt(
        engagements.reduce((sum, e) => sum + (e - mean) ** 2, 0) / engagements.length
      );
      features.volatility = Math.min(1, std / Math.max(1, mean));
    } else {
      features.volatility = 0;
    }

    // Response latency inverse (placeholder: use 0.5 since we lack timestamp pairs)
    features.response_latency_inv = 0.5;
  } catch (err) {
    logger.error('Error extracting behavioral features', { agentId, error: String(err) });
  }

  return features;
}

/**
 * Extract linguistic features from post content.
 * Uses dictionaries and regex patterns — no NLP libraries.
 * Accepts pre-fetched posts to avoid duplicate DB query.
 */
export async function extractLinguisticFeatures(
  agentId: string,
  prefetchedPosts?: PostRow[]
): Promise<Record<string, number>> {
  const features: Record<string, number> = {};

  try {
    // Use first 200 of prefetched posts, or fetch independently
    const allPosts = prefetchedPosts
      ? prefetchedPosts.slice(0, 200)
      : (await fetchPostsForFeatures(agentId)).slice(0, 200);
    if (allPosts.length === 0) {
      return {
        type_token_ratio: 0,
        hedging_ratio: 0,
        certainty_ratio: 0,
        self_focus_ratio: 0,
        self_focus_ratio_inv: 1,
        emotional_word_ratio: 0,
        supportive_word_ratio: 0,
        contrarian_word_ratio: 0,
        question_ratio: 0,
        exclamation_ratio: 0,
        expressive_punctuation: 0,
        readability: 0.5,
      };
    }

    const allText = allPosts.map(p => p.content || '').join(' ');
    const words = allText
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 0);
    const totalWords = words.length;

    if (totalWords === 0) {
      return {
        type_token_ratio: 0,
        hedging_ratio: 0,
        certainty_ratio: 0,
        self_focus_ratio: 0,
        self_focus_ratio_inv: 1,
        emotional_word_ratio: 0,
        supportive_word_ratio: 0,
        contrarian_word_ratio: 0,
        question_ratio: 0,
        exclamation_ratio: 0,
        expressive_punctuation: 0,
        readability: 0.5,
      };
    }

    // Type-token ratio (vocabulary richness)
    // TTR is affected by text length; use a sample of first 1000 words for fairness
    const sampleWords = words.slice(0, 1000);
    const sampleUnique = new Set(sampleWords);
    features.type_token_ratio = sampleWords.length > 0 ? sampleUnique.size / sampleWords.length : 0;

    // Dictionary-based ratios (per 1000 words, normalized to 0-1)
    const hedgingCount = countWordMatches(allText, HEDGING_WORDS);
    features.hedging_ratio = Math.min(1, (hedgingCount / totalWords) * 50);

    const certaintyCount = countWordMatches(allText, CERTAINTY_WORDS);
    features.certainty_ratio = Math.min(1, (certaintyCount / totalWords) * 50);

    const supportiveCount = countWordMatches(allText, SUPPORTIVE_WORDS);
    features.supportive_word_ratio = Math.min(1, (supportiveCount / totalWords) * 50);

    const contrarianCount = countWordMatches(allText, CONTRARIAN_WORDS);
    features.contrarian_word_ratio = Math.min(1, (contrarianCount / totalWords) * 50);

    const emotionalCount = countWordMatches(allText, EMOTIONAL_WORDS);
    features.emotional_word_ratio = Math.min(1, (emotionalCount / totalWords) * 50);

    // Self-focus (I/my/mine per total words)
    const selfCount = countWordMatches(allText, SELF_FOCUS_PRONOUNS);
    features.self_focus_ratio = Math.min(1, (selfCount / totalWords) * 20);
    features.self_focus_ratio_inv = 1 - features.self_focus_ratio;

    // Question & exclamation ratios (per sentence approximation)
    const sentences = allText.split(/[.!?]+/).filter(s => s.trim().length > 0).length || 1;
    const questionCount = (allText.match(/\?/g) || []).length;
    features.question_ratio = Math.min(1, questionCount / sentences);

    const exclamationCount = (allText.match(/!/g) || []).length;
    features.exclamation_ratio = Math.min(1, exclamationCount / sentences);

    // Expressive punctuation (!!!, ..., caps words per total words)
    const expressivePunct = (allText.match(/[!?]{2,}|\.{3,}/g) || []).length;
    features.expressive_punctuation = Math.min(1, expressivePunct / allPosts.length);

    // Simple readability proxy: average words per sentence (normalized, 15-20 words = ideal = 1.0)
    const avgWordsPerSentence = totalWords / sentences;
    features.readability =
      avgWordsPerSentence <= 20
        ? Math.min(1, avgWordsPerSentence / 20)
        : Math.max(0, 1 - (avgWordsPerSentence - 20) / 40);
  } catch (err) {
    logger.error('Error extracting linguistic features', { agentId, error: String(err) });
  }

  return features;
}

/**
 * Extract features from debate and challenge participation.
 */
export async function extractDebateChallengeFeatures(
  agentId: string
): Promise<Record<string, number>> {
  const features: Record<string, number> = {
    debate_participation_rate: 0,
    minority_vote_ratio: 0,
    red_team_ratio: 0,
    evidence_tier_avg: 0,
    evidence_quality: 0,
  };

  try {
    // Debate entries count
    const { count: debateEntryCount } = await supabase
      .from('debate_entries')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId);

    // Total debates available (approximate from recent)
    const { count: totalDebates } = await supabase
      .from('debates')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'closed']);

    features.debate_participation_rate =
      totalDebates && totalDebates > 0 ? Math.min(1, (debateEntryCount || 0) / totalDebates) : 0;

    // Challenge participation roles
    const { data: participantRoles } = await supabase
      .from('challenge_participants')
      .select('role')
      .eq('agent_id', agentId)
      .limit(200);

    const roles = participantRoles || [];
    if (roles.length > 0) {
      const redTeamCount = roles.filter(
        r => r.role === 'red_team' || r.role === 'contrarian'
      ).length;
      features.red_team_ratio = redTeamCount / roles.length;
    }

    // Evidence tiers on contributions
    const { data: contributions } = await supabase
      .from('challenge_contributions')
      .select('evidence_tier')
      .eq('agent_id', agentId)
      .limit(200);

    const contribs = contributions || [];
    if (contribs.length > 0) {
      const tierMap: Record<string, number> = {
        empirical: 1.0,
        logical: 0.75,
        analogical: 0.5,
        speculative: 0.25,
      };
      const tierScores = contribs
        .filter(c => c.evidence_tier)
        .map(c => tierMap[c.evidence_tier!] ?? 0.5);
      if (tierScores.length > 0) {
        features.evidence_tier_avg = tierScores.reduce((a, b) => a + b, 0) / tierScores.length;
        features.evidence_quality = features.evidence_tier_avg;
      }
    }

    // Minority vote ratio (debate votes on losing side)
    const { data: agentVotes } = await supabase
      .from('debate_votes')
      .select('entry_id, debate_id')
      .eq('voter_agent_id', agentId)
      .limit(100);

    if (agentVotes && agentVotes.length > 0) {
      // Check which entries won their debates
      const debateIds = [...new Set(agentVotes.map(v => v.debate_id))];
      const { data: debateResults } = await supabase
        .from('debates')
        .select('id, winner_entry_id')
        .in('id', debateIds)
        .not('winner_entry_id', 'is', null)
        .limit(100);

      if (debateResults && debateResults.length > 0) {
        const winnerMap = new Map(debateResults.map(d => [d.id, d.winner_entry_id]));
        let minorityCount = 0;
        let resolvedCount = 0;
        for (const vote of agentVotes) {
          const winner = winnerMap.get(vote.debate_id);
          if (winner) {
            resolvedCount++;
            if (vote.entry_id !== winner) minorityCount++;
          }
        }
        features.minority_vote_ratio = resolvedCount > 0 ? minorityCount / resolvedCount : 0;
      }
    }
  } catch (err) {
    logger.error('Error extracting debate/challenge features', { agentId, error: String(err) });
  }

  return features;
}

/**
 * Extract network/social graph features.
 */
export async function extractNetworkFeatures(agentId: string): Promise<Record<string, number>> {
  const features: Record<string, number> = {
    follower_ratio: 0.5,
    follow_reciprocity: 0,
    engagement_reciprocity: 0,
    in_group_engagement: 0,
    out_group_engagement: 0,
    reply_down_ratio: 0,
    reply_peer_ratio: 0.5,
  };

  try {
    // Get follower/following counts
    const { data: agent } = await supabase
      .from('agents')
      .select('follower_count, following_count')
      .eq('id', agentId)
      .is('deleted_at', null)
      .maybeSingle();

    if (agent) {
      const followers = agent.follower_count || 0;
      const following = agent.following_count || 0;
      // Follower ratio: followers / (followers + following), 0.5 = balanced
      features.follower_ratio =
        followers + following > 0 ? followers / (followers + following) : 0.5;
    }

    // Follow reciprocity: how many agents they follow also follow them back
    const { data: followingList } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', agentId)
      .limit(200);

    const { data: followerList } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', agentId)
      .limit(200);

    if (followingList && followerList) {
      const followingSet = new Set(followingList.map(f => f.following_id));
      const followerSet = new Set(followerList.map(f => f.follower_id));
      const mutual = [...followingSet].filter(id => followerSet.has(id)).length;
      features.follow_reciprocity = followingSet.size > 0 ? mutual / followingSet.size : 0;

      // In-group engagement: how much they interact with people they follow
      const { data: replyTargets } = await supabase
        .from('posts')
        .select('reply_to_id')
        .eq('agent_id', agentId)
        .not('reply_to_id', 'is', null)
        .is('deleted_at', null)
        .limit(200);

      if (replyTargets && replyTargets.length > 0) {
        // Get authors of posts they replied to
        const replyToIds = replyTargets.map(r => r.reply_to_id!).slice(0, 100);
        const { data: repliedPosts } = await supabase
          .from('posts')
          .select('agent_id')
          .in('id', replyToIds)
          .is('deleted_at', null)
          .limit(100);

        if (repliedPosts && repliedPosts.length > 0) {
          const replyAgentIds = repliedPosts.map(p => p.agent_id);
          const inGroupReplies = replyAgentIds.filter(id => followingSet.has(id)).length;
          features.in_group_engagement = inGroupReplies / replyAgentIds.length;
          features.out_group_engagement = 1 - features.in_group_engagement;

          // Reply direction (up = to agents with more followers, down = fewer)
          // Simplified: ratio of replies to agents in following list (peers) vs not
          features.reply_peer_ratio = features.in_group_engagement;
          features.reply_down_ratio = features.out_group_engagement * 0.5; // approximation
        }
      }
    }

    // Engagement reciprocity: likes given to agents who also like their posts
    const { data: likesGiven } = await supabase
      .from('likes')
      .select('post_id')
      .eq('agent_id', agentId)
      .limit(100);

    const { data: likesReceived } = await supabase
      .from('likes')
      .select('agent_id')
      .eq('agent_id', agentId)
      .limit(100);

    if (likesGiven && likesReceived) {
      // Get agents of posts they liked
      const likedPostIds = likesGiven.map(l => l.post_id).slice(0, 50);
      if (likedPostIds.length > 0) {
        const { data: likedPosts } = await supabase
          .from('posts')
          .select('agent_id')
          .in('id', likedPostIds)
          .is('deleted_at', null)
          .limit(50);

        if (likedPosts) {
          const likedAgents = new Set(likedPosts.map(p => p.agent_id));
          const likersOfMe = new Set(likesReceived.map(l => l.agent_id));
          const mutualLikers = [...likedAgents].filter(id => likersOfMe.has(id)).length;
          features.engagement_reciprocity =
            likedAgents.size > 0 ? mutualLikers / likedAgents.size : 0;
        }
      }
    }
  } catch (err) {
    logger.error('Error extracting network features', { agentId, error: String(err) });
  }

  return features;
}

/**
 * Extract all feature families for an agent.
 * Fetches posts once and shares them between behavioral + linguistic extractors.
 */
export async function extractAllFeatures(agentId: string): Promise<FeatureVector> {
  // Single post fetch shared by behavioral + linguistic (saves 1 query per agent)
  const posts = await fetchPostsForFeatures(agentId);

  const [behavioral, linguistic, debate_challenge, network] = await Promise.all([
    extractBehavioralFeatures(agentId, posts),
    extractLinguisticFeatures(agentId, posts),
    extractDebateChallengeFeatures(agentId),
    extractNetworkFeatures(agentId),
  ]);

  return { behavioral, linguistic, debate_challenge, network };
}
