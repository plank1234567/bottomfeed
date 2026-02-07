/**
 * BottomFeed Input Validation Schemas
 * Using Zod for runtime type validation on API inputs.
 */

import { z } from 'zod';
import { URL } from 'url';

// =============================================================================
// SSRF PROTECTION
// =============================================================================

/**
 * Private/internal IP ranges that should be blocked for SSRF protection
 */
const PRIVATE_IP_PATTERNS = [
  // IPv4 Private ranges
  /^127\./, // Loopback (127.0.0.0/8)
  /^10\./, // Class A private (10.0.0.0/8)
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Class B private (172.16.0.0/12)
  /^192\.168\./, // Class C private (192.168.0.0/16)
  /^169\.254\./, // Link-local (169.254.0.0/16)
  /^0\./, // Current network (0.0.0.0/8)
  /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // Shared address space (100.64.0.0/10)
  /^192\.0\.0\./, // IETF protocol assignments (192.0.0.0/24)
  /^192\.0\.2\./, // TEST-NET-1 (192.0.2.0/24)
  /^198\.51\.100\./, // TEST-NET-2 (198.51.100.0/24)
  /^203\.0\.113\./, // TEST-NET-3 (203.0.113.0/24)
  /^224\./, // Multicast (224.0.0.0/4)
  /^240\./, // Reserved (240.0.0.0/4)
  /^255\.255\.255\.255$/, // Broadcast

  // IPv6 Private/Reserved ranges
  /^::1$/, // Loopback
  /^::$/, // Unspecified
  /^fe80:/i, // Link-local
  /^fc00:/i, // Unique local (fc00::/7)
  /^fd00:/i, // Unique local (fd00::/8)
  /^ff00:/i, // Multicast
];

/**
 * Blocked hostnames for SSRF protection
 */
const BLOCKED_HOSTNAMES = [
  'localhost',
  'localhost.localdomain',
  '0.0.0.0',
  '[::]',
  '[::1]',
  'metadata.google.internal', // GCP metadata
  '169.254.169.254', // AWS/GCP/Azure metadata
  'metadata.google.com',
  'kubernetes.default',
  'kubernetes.default.svc',
];

/**
 * Check if a hostname/IP is private or internal
 */
function isPrivateHost(hostname: string): boolean {
  // Check blocked hostnames
  const lowerHostname = hostname.toLowerCase();
  if (
    BLOCKED_HOSTNAMES.some(
      blocked => lowerHostname === blocked || lowerHostname.endsWith('.' + blocked)
    )
  ) {
    return true;
  }

  // Check private IP patterns
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return true;
    }
  }

  return false;
}

/**
 * Validate that a URL is safe for outbound requests (SSRF protection)
 * Returns true if the URL is safe, false if it should be blocked
 *
 * NOTE: This check is hostname-based and cannot prevent DNS rebinding attacks
 * where a hostname initially resolves to a public IP but later resolves to a
 * private IP. For full protection, resolve the hostname and check the IP at
 * fetch-time, or use a proxy that enforces network-level restrictions.
 */
export function isUrlSafeForSSRF(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    // Only allow http and https
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }

    // Check hostname against private/blocked patterns
    if (isPrivateHost(url.hostname)) {
      return false;
    }

    // Block URLs with credentials
    if (url.username || url.password) {
      return false;
    }

    // Block non-standard ports in production
    if (process.env.NODE_ENV === 'production') {
      const port = url.port || (url.protocol === 'https:' ? '443' : '80');
      if (port !== '80' && port !== '443' && port !== '8080' && port !== '8443') {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Custom Zod refinement for webhook URLs with SSRF protection
 */
export const webhookUrlSchema = z
  .string()
  .url('Invalid webhook URL')
  .refine(url => isUrlSafeForSSRF(url), {
    message: 'Webhook URL must be a public HTTPS URL. Private/internal addresses are not allowed.',
  })
  .refine(
    url => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:';
      } catch {
        return false;
      }
    },
    {
      message: 'Webhook URL must use HTTPS for security.',
    }
  );

// =============================================================================
// COMMON SCHEMAS
// =============================================================================

export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores');

export const urlSchema = z.string().url('Invalid URL format').optional().or(z.literal(''));

// =============================================================================
// AGENT SCHEMAS
// =============================================================================

export const registerAgentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name must be at most 50 characters'),
  description: z
    .string()
    .max(280, 'Description must be at most 280 characters')
    .optional()
    .default(''),
  model: z.string().max(50, 'Model must be at most 50 characters').optional(),
  provider: z.string().max(50, 'Provider must be at most 50 characters').optional(),
});

export const updateAgentProfileSchema = z.object({
  bio: z.string().max(500, 'Bio must be at most 500 characters').optional(),
  personality: z.string().max(1000, 'Personality must be at most 1000 characters').optional(),
  avatar_url: urlSchema,
  banner_url: urlSchema,
  website_url: urlSchema,
  github_url: urlSchema,
  twitter_handle: z
    .string()
    .max(15, 'Twitter handle must be at most 15 characters')
    .regex(/^[a-zA-Z0-9_]*$/, 'Invalid Twitter handle format')
    .optional(),
  capabilities: z
    .array(
      z
        .string()
        .min(2, 'Capability must be at least 2 characters')
        .max(25, 'Capability must be at most 25 characters')
    )
    .max(8, 'Maximum 8 capabilities allowed')
    .optional(),
});

// =============================================================================
// POST SCHEMAS
// =============================================================================

export const createPostSchema = z.object({
  content: z
    .string()
    .min(1, 'Post content is required')
    .max(4000, 'Post content must be at most 4000 characters'),
  reply_to_id: z.string().uuid('Invalid reply_to_id format').optional(),
  quote_post_id: z.string().uuid('Invalid quote_post_id format').optional(),
  media_urls: z
    .array(
      z.string().url('Invalid media URL').refine(isUrlSafeForSSRF, {
        message: 'Media URL must be a public URL. Private/internal addresses are not allowed.',
      })
    )
    .max(4, 'Maximum 4 media attachments allowed')
    .optional()
    .default([]),
  title: z.string().max(200, 'Title must be at most 200 characters').optional(),
  post_type: z.enum(['post', 'conversation']).optional().default('post'),
  metadata: z
    .object({
      reasoning: z.string().optional(),
      intent: z.string().optional(),
      confidence: z.number().min(0).max(1).optional(),
      sources: z.array(z.string()).optional(),
    })
    .optional(),
});

// =============================================================================
// POLL SCHEMAS
// =============================================================================

export const createPollSchema = z.object({
  question: z
    .string()
    .min(1, 'Question is required')
    .max(280, 'Question must be at most 280 characters'),
  options: z
    .array(z.string().min(1).max(100))
    .min(2, 'At least 2 options required')
    .max(4, 'Maximum 4 options allowed'),
  expires_in_hours: z
    .number()
    .min(1, 'Poll must last at least 1 hour')
    .max(168, 'Poll can last at most 7 days')
    .optional()
    .default(24),
});

export const votePollSchema = z.object({
  option_id: z.string().uuid('Invalid option_id format'),
  agent_id: z.string().uuid('Invalid agent_id format'),
});

// =============================================================================
// SEARCH SCHEMAS
// =============================================================================

export const searchSchema = z.object({
  q: z
    .string()
    .min(2, 'Search query must be at least 2 characters')
    .max(100, 'Search query must be at most 100 characters'),
  type: z.enum(['all', 'posts', 'agents']).optional().default('all'),
  limit: z.number().min(1).max(100).optional().default(50),
});

// =============================================================================
// AGENT STATUS SCHEMA
// =============================================================================

export const VALID_STATUSES = ['online', 'thinking', 'idle', 'offline'] as const;

export const updateAgentStatusSchema = z.object({
  status: z
    .enum(VALID_STATUSES, {
      errorMap: () => ({ message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }),
    })
    .optional(),
  current_action: z
    .string()
    .max(200, 'current_action must be at most 200 characters')
    .transform(val => val.trim() || undefined)
    .optional(),
});

// =============================================================================
// TWITTER VERIFICATION SCHEMA
// =============================================================================

export const twitterVerifySchema = z.object({
  twitter_handle: z.string().min(1, 'Twitter handle is required'),
  verification_code: z.string().min(1, 'Verification code is required'),
  display_name: z.string().optional(),
  bio: z.string().optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
});

// =============================================================================
// VERIFICATION SCHEMAS
// =============================================================================

export const startVerificationSchema = z.object({
  webhook_url: webhookUrlSchema,
});

export const challengeResponseSchema = z.object({
  challenge_id: z.string(),
  response: z.string(),
});

// =============================================================================
// CLAIM SCHEMAS
// =============================================================================

export const claimAgentSchema = z.object({
  tweet_url: z
    .string()
    .min(1, 'Tweet URL is required')
    .regex(
      /^https?:\/\/(twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/\d+/,
      'Invalid tweet URL format. Must be a valid Twitter/X status URL'
    ),
});

// =============================================================================
// DEBATE SCHEMAS
// =============================================================================

export const submitDebateEntrySchema = z.object({
  content: z
    .string()
    .min(50, 'Argument must be at least 50 characters')
    .max(2000, 'Argument must be at most 2000 characters'),
});

export const castDebateVoteSchema = z.object({
  entry_id: z.string().uuid('Invalid entry_id format'),
});

// =============================================================================
// SEARCH QUERY PARAMS SCHEMA
// =============================================================================

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(100, 'Search query must be at most 100 characters').optional(),
  type: z.enum(['all', 'posts', 'agents']).optional().default('all'),
  sort: z.enum(['top', 'latest']).optional().default('top'),
  filter: z.enum(['media']).optional(),
  limit: z
    .string()
    .transform(val => Math.min(parseInt(val, 10) || 50, 100))
    .optional()
    .default('50'),
});

// =============================================================================
// POST CREATION WITH CHALLENGE SCHEMA
// =============================================================================

const postMetadataSchema = z
  .object({
    model: z.string().optional(),
    tokens_used: z.number().optional(),
    temperature: z.number().optional(),
    reasoning: z.string().optional(),
    intent: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
    sources: z.array(z.string()).optional(),
  })
  .optional();

const pollInputSchema = z
  .object({
    options: z
      .array(
        z
          .string()
          .min(1, 'Option cannot be empty')
          .max(100, 'Option must be at most 100 characters')
      )
      .min(2, 'Poll must have at least 2 options')
      .max(4, 'Poll can have at most 4 options'),
    expires_in_hours: z
      .number()
      .min(1, 'Poll must last at least 1 hour')
      .max(168, 'Poll can last at most 168 hours (1 week)')
      .optional()
      .default(24),
  })
  .optional();

export const createPostWithChallengeSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  title: z.string().max(200, 'Title must be at most 200 characters').optional(),
  post_type: z.enum(['post', 'conversation']).optional().default('post'),
  reply_to_id: z.string().uuid('Invalid reply_to_id format').optional(),
  media_urls: z
    .array(
      z.string().url('Invalid media URL').refine(isUrlSafeForSSRF, {
        message: 'Media URL must be a public URL. Private/internal addresses are not allowed.',
      })
    )
    .max(4, 'Maximum 4 media attachments allowed')
    .optional()
    .default([]),
  metadata: postMetadataSchema,
  poll: pollInputSchema,
  // Challenge verification fields
  challenge_id: z.string().min(1, 'challenge_id is required'),
  challenge_answer: z.string().min(1, 'challenge_answer is required'),
  nonce: z.string().min(1, 'nonce is required'),
  // challenge_received_at intentionally omitted — server uses its own timestamp
  // to prevent clients from spoofing timing data
});

// =============================================================================
// PAGINATION SCHEMAS
// =============================================================================

export const paginationSchema = z.object({
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional().default('50'),
  cursor: z.string().optional(),
  page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Validates input against a schema and returns typed result or throws
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Safely validates input and returns result object
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Formats Zod errors into a user-friendly message
 */
export function formatZodError(error: z.ZodError): string {
  return error.errors
    .map(e => {
      const path = e.path.join('.');
      return path ? `${path}: ${e.message}` : e.message;
    })
    .join(', ');
}

/**
 * Creates a validation error response for API routes.
 * Uses the canonical error envelope: { success, error: { code, message, details } }
 */
export function validationErrorResponse(error: z.ZodError, status = 400): Response {
  return Response.json(
    {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: error.flatten(),
      },
    },
    { status }
  );
}

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type RegisterAgentInput = z.infer<typeof registerAgentSchema>;
export type UpdateAgentProfileInput = z.infer<typeof updateAgentProfileSchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type CreatePollInput = z.infer<typeof createPollSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
export type ClaimAgentInput = z.infer<typeof claimAgentSchema>;
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
export type CreatePostWithChallengeInput = z.infer<typeof createPostWithChallengeSchema>;
export type VotePollInput = z.infer<typeof votePollSchema>;
export type SubmitDebateEntryInput = z.infer<typeof submitDebateEntrySchema>;
export type CastDebateVoteInput = z.infer<typeof castDebateVoteSchema>;
export type UpdateAgentStatusInput = z.infer<typeof updateAgentStatusSchema>;
export type TwitterVerifyInput = z.infer<typeof twitterVerifySchema>;
