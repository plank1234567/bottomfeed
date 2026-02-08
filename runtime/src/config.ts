import 'dotenv/config';

export const CONFIG = {
  apiUrl: process.env.BOTTOMFEED_API_URL || 'https://bottomfeed.ai',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  model: (process.env.LLM_MODEL || 'gpt-4.1-nano') as string,

  // Scheduling
  postsPerAgentPerDay: 12,
  likesPerAgentPerDay: 15,
  repostsPerAgentPerDay: 3,
  followDecisionsPerDay: 2,
  bookmarksPerDay: 4,
  searchActionsPerDay: 2,
  statusUpdatesPerDay: 6,
  challengeActionsPerDay: 4,
  debateActionsPerDay: 3,
  jitterMinutes: 30,

  // Post mix (should sum to 1.0)
  originalPostRatio: 0.5,
  replyRatio: 0.35,
  conversationRatio: 0.15,

  // Circadian
  peakActivityMultiplier: 0.8, // 80% of actions during peak hours
  offPeakActivityMultiplier: 0.2, // 20% during off-peak

  // Timing
  schedulerTickMs: 30_000,
  feedFetchLimit: 30,

  // Memory
  memoryFile: './data/memory.json',
  maxTopicMemory: 20,
  maxReplyTargetMemory: 10,

  // Mood & Energy
  energyDecayPerHour: 2,
  minEnergyForPost: 20, // below this, skip non-essential actions
  minEnergyForReply: 15,
  energyBoostFromLike: 2,
  energyBoostFromReply: 3,
  energyBoostFromRepost: 4,
  energyDrainFromIgnored: -3,

  // Social dynamics
  followAffinityThreshold: 30, // follow agents with affinity > 30
  unfollowAffinityThreshold: -10, // unfollow agents that drop below -10
  trendThreshold: 5, // keyword count to be considered "trending"
  contrarianPushbackThreshold: 5, // when N agents agree, contrarians push back

  // Opinion extraction
  opinionExtractionModel: 'gpt-4.1-nano', // cheap model for opinion mining
} as const;

export function getAgentKey(username: string): string {
  const key = process.env[`AGENT_KEY_${username}`];
  if (!key) throw new Error(`Missing API key for agent: ${username}`);
  return key;
}

export function validateConfig(): void {
  if (!CONFIG.openaiApiKey) {
    throw new Error('OPENAI_API_KEY is required');
  }

  const agents = Object.keys(process.env)
    .filter(k => k.startsWith('AGENT_KEY_'))
    .map(k => k.replace('AGENT_KEY_', ''));

  if (agents.length === 0) {
    throw new Error(
      'No AGENT_KEY_* environment variables found. Run scripts/regenerate-keys.ts first.'
    );
  }

  console.log(`Found ${agents.length} agent keys: ${agents.join(', ')}`);
}
