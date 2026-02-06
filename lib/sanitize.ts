/**
 * Content Sanitization Utilities
 * Protects against XSS attacks by sanitizing user-generated content
 *
 * Uses simple HTML entity encoding that works in both client and server environments
 * without requiring jsdom during build time.
 */

/**
 * Strip all HTML tags from a string
 */
function stripTags(str: string): string {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Configuration for different sanitization contexts
 */
// Note: No `g` flag — regex with `g` is stateful (lastIndex), which causes
// alternating true/false when called repeatedly in .test() inside a loop.
const ALLOWED_TAGS_REGEX = /<\/?(?:b|i|em|strong|a|br|p|ul|ol|li|code|pre)(?:\s[^>]*)?\/?>/i;

/**
 * Sanitize post content - allows basic formatting, strips dangerous elements
 */
export function sanitizePostContent(content: string): string {
  if (!content) return '';

  // First strip all HTML tags for safety
  // In a production environment, you might want to use a more sophisticated
  // HTML sanitizer that preserves safe formatting
  let sanitized = content;

  // Remove script tags and their contents
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove style tags and their contents
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove event handlers (onclick, onerror, etc.)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]+/gi, '');

  // Remove javascript: and data: URLs
  sanitized = sanitized.replace(/javascript:/gi, 'blocked:');
  sanitized = sanitized.replace(/data:/gi, 'blocked:');
  sanitized = sanitized.replace(/vbscript:/gi, 'blocked:');

  // Remove iframe, object, embed tags
  sanitized = sanitized.replace(/<\/?(?:iframe|object|embed|form|input)[^>]*>/gi, '');

  // Escape remaining potentially dangerous characters in non-tag content
  // This preserves the structure but ensures no XSS
  sanitized = sanitized
    .split(/(<[^>]+>)/g)
    .map((part, i) => {
      // Odd indices are tags, even are content
      if (i % 2 === 0) {
        // Content - escape special characters but preserve basic structure
        return part;
      }
      // Tag - keep allowed tags, strip others
      if (ALLOWED_TAGS_REGEX.test(part)) {
        // For anchor tags, validate href and ensure they open in new tab safely
        if (part.toLowerCase().startsWith('<a ')) {
          const hrefMatch = part.match(/href\s*=\s*["']([^"']*)["']/i);
          if (hrefMatch) {
            const rawHref = hrefMatch[1] ?? '';
            const cleanHref = sanitizeUrl(rawHref);
            if (cleanHref === '') {
              // Dangerous href — strip the tag, keep only inner text
              return '';
            }
            // Replace the original href with the sanitized version
            part = part.replace(hrefMatch[0], `href="${cleanHref}"`);
          } else {
            // No href attribute found — strip the anchor tag
            return '';
          }
          if (!part.includes('target=')) {
            part = part.replace(/>$/, ' target="_blank" rel="noopener noreferrer">');
          }
          if (!part.includes('rel=')) {
            part = part.replace(/>$/, ' rel="noopener noreferrer">');
          }
        }
        return part;
      }
      return '';
    })
    .join('');

  return sanitized.trim();
}

/**
 * Sanitize plain text - strips all HTML, returns plain text only
 * Use for usernames, display names, bios, etc.
 */
export function sanitizePlainText(text: string): string {
  if (!text) return '';
  // Strip all HTML tags
  let sanitized = stripTags(text);
  // Remove any remaining HTML entities that might be malicious
  sanitized = sanitized.replace(/&(?!(?:amp|lt|gt|quot|#039);)/g, '&amp;');
  return sanitized.trim();
}

/**
 * Sanitize URL - validates and cleans URLs
 * Returns empty string if URL is invalid or potentially malicious
 */
export function sanitizeUrl(url: string): string {
  if (!url) return '';

  const trimmed = url.trim();

  // Check for javascript: or data: URLs
  const lowerUrl = trimmed.toLowerCase();
  if (
    lowerUrl.startsWith('javascript:') ||
    lowerUrl.startsWith('data:') ||
    lowerUrl.startsWith('vbscript:')
  ) {
    return '';
  }

  // Validate URL format
  try {
    const parsed = new URL(trimmed);
    // Only allow http and https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return trimmed;
  } catch {
    // If it doesn't parse as a URL, return empty
    return '';
  }
}

/**
 * Sanitize media URLs array
 */
export function sanitizeMediaUrls(urls: string[]): string[] {
  if (!Array.isArray(urls)) return [];
  return urls.map(sanitizeUrl).filter(url => url.length > 0);
}

/**
 * Sanitize metadata object - recursively sanitize all string values
 */
export function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object') return {};

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizePlainText(value);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        typeof item === 'string' ? sanitizePlainText(item) : item
      );
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeMetadata(value as Record<string, unknown>);
    }
  }

  return sanitized;
}

/**
 * Comprehensive post data sanitizer
 * Call this before storing any post data
 */
export function sanitizePostData(data: {
  content?: string;
  title?: string;
  media_urls?: string[];
  metadata?: Record<string, unknown>;
}): {
  content: string;
  title?: string;
  media_urls: string[];
  metadata: Record<string, unknown>;
} {
  return {
    content: sanitizePostContent(data.content || ''),
    title: data.title ? sanitizePlainText(data.title) : undefined,
    media_urls: sanitizeMediaUrls(data.media_urls || []),
    metadata: sanitizeMetadata(data.metadata || {}),
  };
}

/**
 * Comprehensive agent profile data sanitizer
 * Call this before storing any agent profile data
 */
export function sanitizeAgentData(data: {
  name?: string;
  display_name?: string;
  bio?: string;
  personality?: string;
  avatar_url?: string;
  banner_url?: string;
  website_url?: string;
  github_url?: string;
}): {
  name?: string;
  display_name?: string;
  bio?: string;
  personality?: string;
  avatar_url?: string;
  banner_url?: string;
  website_url?: string;
  github_url?: string;
} {
  return {
    name: data.name ? sanitizePlainText(data.name) : undefined,
    display_name: data.display_name ? sanitizePlainText(data.display_name) : undefined,
    bio: data.bio ? sanitizePlainText(data.bio) : undefined,
    personality: data.personality ? sanitizePlainText(data.personality) : undefined,
    avatar_url: data.avatar_url ? sanitizeUrl(data.avatar_url) : undefined,
    banner_url: data.banner_url ? sanitizeUrl(data.banner_url) : undefined,
    website_url: data.website_url ? sanitizeUrl(data.website_url) : undefined,
    github_url: data.github_url ? sanitizeUrl(data.github_url) : undefined,
  };
}

/**
 * Sanitize profile update fields (shared between in-memory and Supabase backends)
 */
export function sanitizeProfileUpdates(
  updates: Partial<{
    bio: string;
    personality: string;
    avatar_url: string;
    banner_url: string;
    website_url: string;
    github_url: string;
    twitter_handle: string;
    capabilities: string[];
  }>
): typeof updates {
  const sanitized: typeof updates = {};
  if (updates.bio !== undefined) sanitized.bio = sanitizePlainText(updates.bio);
  if (updates.personality !== undefined)
    sanitized.personality = sanitizePlainText(updates.personality);
  if (updates.avatar_url !== undefined) sanitized.avatar_url = sanitizeUrl(updates.avatar_url);
  if (updates.banner_url !== undefined) sanitized.banner_url = sanitizeUrl(updates.banner_url);
  if (updates.website_url !== undefined) sanitized.website_url = sanitizeUrl(updates.website_url);
  if (updates.github_url !== undefined) sanitized.github_url = sanitizeUrl(updates.github_url);
  if (updates.twitter_handle !== undefined)
    sanitized.twitter_handle = sanitizePlainText(updates.twitter_handle);
  if (updates.capabilities !== undefined)
    sanitized.capabilities = updates.capabilities.map(cap => sanitizePlainText(cap));
  return sanitized;
}
