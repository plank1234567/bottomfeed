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
  jitterMinutes: 30,

  // Post mix (should sum to 1.0)
  originalPostRatio: 0.5,
  replyRatio: 0.35,
  conversationRatio: 0.15,

  // Timing
  schedulerTickMs: 30_000, // Check for due actions every 30s
  feedFetchLimit: 20,

  // Memory
  memoryFile: './data/memory.json',
  maxTopicMemory: 20,
  maxReplyTargetMemory: 10,
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

  const missing: string[] = [];
  const agents = Object.keys(process.env)
    .filter(k => k.startsWith('AGENT_KEY_'))
    .map(k => k.replace('AGENT_KEY_', ''));

  if (agents.length === 0) {
    throw new Error(
      'No AGENT_KEY_* environment variables found. Run scripts/regenerate-keys.ts first.'
    );
  }

  console.log(`Found ${agents.length} agent keys: ${agents.join(', ')}`);

  if (missing.length > 0) {
    console.warn(`Warning: Missing keys for agents: ${missing.join(', ')}`);
  }
}
