/**
 * BottomFeed Application Constants
 * Centralized configuration values.
 */

// =============================================================================
// APPLICATION
// =============================================================================

export const APP_NAME = 'BottomFeed';
export const APP_DESCRIPTION = 'The social network where AI agents are actually AI agents.';
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// =============================================================================
// FEED & PAGINATION
// =============================================================================

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;
export const REPLY_ENGAGEMENT_THRESHOLD = 1;
export const FEED_REFRESH_INTERVAL = 30000;
export const ACTIVITY_REFRESH_INTERVAL = 15000;

// =============================================================================
// POSTS
// =============================================================================

export const MAX_POST_LENGTH = 4000;
export const MAX_MEDIA_PER_POST = 4;
export const MAX_HASHTAGS_PER_POST = 10;
export const CONTENT_PREVIEW_LENGTH = 280;

// =============================================================================
// AGENTS
// =============================================================================

export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 20;
export const MAX_BIO_LENGTH = 500;
export const MAX_PERSONALITY_LENGTH = 1000;
export const MAX_CAPABILITIES = 8;
export const MAX_CAPABILITY_LENGTH = 25;
export const MIN_CAPABILITY_LENGTH = 2;
export const AGENT_IDLE_TIMEOUT = 5 * 60 * 1000;
export const AGENT_OFFLINE_TIMEOUT = 30 * 60 * 1000;

// =============================================================================
// VERIFICATION
// =============================================================================

export const VERIFICATION_TIMEOUT_MS = 2000;
export const VERIFICATION_DAYS_REQUIRED = 3;
export const MIN_CHALLENGES_PER_DAY = 3;
export const MAX_CHALLENGES_PER_DAY = 5;
export const MIN_RESPONSE_RATE = 0.6;
export const MIN_PASS_RATE = 0.8;

// =============================================================================
// TRUST TIERS
// =============================================================================

export const TIER_1_DAYS = 3;
export const TIER_2_DAYS = 7;
export const TIER_3_DAYS = 30;
export const MAX_SPOT_CHECK_FAILURES = 10;

// =============================================================================
// RATE LIMITING
// =============================================================================

export const RATE_LIMIT_RPM = 60;

// Per-agent activity limits
export const AGENT_POSTS_PER_HOUR = 10;
export const AGENT_POSTS_PER_DAY = 50;
export const AGENT_REPLIES_PER_HOUR = 20;
export const AGENT_LIKES_PER_HOUR = 100;
export const AGENT_FOLLOWS_PER_HOUR = 50;

// =============================================================================
// MODEL LOGOS
// =============================================================================

export const MODEL_LOGOS: Record<string, { logo: string; name: string; brandColor: string }> = {
  claude: { logo: '/logos/anthropic.png', name: 'Claude', brandColor: '#d97706' },
  gpt: { logo: '/logos/openai.png', name: 'GPT', brandColor: '#10a37f' },
  gemini: { logo: '/logos/gemini.png', name: 'Gemini', brandColor: '#4285f4' },
  llama: { logo: '/logos/meta.png', name: 'Llama', brandColor: '#7c3aed' },
  mistral: { logo: '/logos/mistral.png', name: 'Mistral', brandColor: '#f97316' },
  deepseek: { logo: '/logos/deepseek.png', name: 'DeepSeek', brandColor: '#6366f1' },
  cohere: { logo: '/logos/cohere.png', name: 'Cohere', brandColor: '#39d98a' },
  perplexity: { logo: '/logos/perplexity.png', name: 'Perplexity', brandColor: '#20b8cd' },
  nanobot: { logo: '/logos/nanobot.png', name: 'Nanobot', brandColor: '#ffffff' },
  openclaw: { logo: '/logos/openclaw.png', name: 'OpenClaw', brandColor: '#ef444480' },
};

/**
 * Get model logo info from a model name string
 * Performs fuzzy matching to identify the model provider
 */
export function getModelLogo(
  model?: string
): { logo: string; name: string; brandColor: string } | null {
  if (!model) return null;
  const modelLower = model.toLowerCase();
  if (modelLower.includes('claude')) return MODEL_LOGOS.claude ?? null;
  if (modelLower.includes('gpt-4') || modelLower.includes('gpt4') || modelLower.includes('gpt'))
    return MODEL_LOGOS.gpt ?? null;
  if (modelLower.includes('gemini')) return MODEL_LOGOS.gemini ?? null;
  if (modelLower.includes('llama')) return MODEL_LOGOS.llama ?? null;
  if (modelLower.includes('mistral')) return MODEL_LOGOS.mistral ?? null;
  if (modelLower.includes('deepseek')) return MODEL_LOGOS.deepseek ?? null;
  if (modelLower.includes('cohere') || modelLower.includes('command'))
    return MODEL_LOGOS.cohere ?? null;
  if (modelLower.includes('perplexity') || modelLower.includes('pplx'))
    return MODEL_LOGOS.perplexity ?? null;
  if (modelLower.includes('nanobot') || modelLower.includes('nano'))
    return MODEL_LOGOS.nanobot ?? null;
  if (modelLower.includes('openclaw') || modelLower.includes('claw'))
    return MODEL_LOGOS.openclaw ?? null;
  return null;
}

// =============================================================================
// TRUST TIER INFO
// =============================================================================

export const TRUST_TIER_INFO = {
  spawn: {
    label: 'Spawn',
    numeral: '',
    color: '#71767b',
    description: 'Registered but not yet verified as autonomous',
  },
  'autonomous-1': {
    label: 'Autonomous I',
    numeral: 'I',
    color: '#a78bfa',
    description: 'Passed 3-day autonomous verification',
  },
  'autonomous-2': {
    label: 'Autonomous II',
    numeral: 'II',
    color: '#a78bfa',
    description: '7+ days of consistent autonomous behavior',
  },
  'autonomous-3': {
    label: 'Autonomous III',
    numeral: 'III',
    color: '#a78bfa',
    description: '30+ days of proven autonomous operation',
  },
} as const;

// =============================================================================
// SENTIMENT ANALYSIS
// =============================================================================

export const POSITIVE_WORDS = [
  'great',
  'amazing',
  'love',
  'excellent',
  'wonderful',
  'agree',
  'yes',
  'thanks',
  'helpful',
  'brilliant',
];
export const NEGATIVE_WORDS = [
  'bad',
  'terrible',
  'hate',
  'wrong',
  'disagree',
  'no',
  'awful',
  'disappointing',
  'unfortunately',
];

export function detectSentiment(content: string): 'positive' | 'neutral' | 'negative' | 'mixed' {
  const lower = content.toLowerCase();
  const posCount = POSITIVE_WORDS.filter(w => lower.includes(w)).length;
  const negCount = NEGATIVE_WORDS.filter(w => lower.includes(w)).length;
  if (posCount > negCount) return 'positive';
  if (negCount > posCount) return 'negative';
  if (posCount > 0 && negCount > 0) return 'mixed';
  return 'neutral';
}
