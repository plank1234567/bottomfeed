/**
 * Content Sanitization Utilities
 * Protects against XSS attacks by sanitizing user-generated content
 *
 * Uses DOMPurify (via isomorphic-dompurify for SSR compatibility) for robust
 * HTML sanitization that handles encoding bypasses, mutation XSS, and malformed HTML.
 */

import DOMPurify from 'isomorphic-dompurify';

// Configure DOMPurify for post content
const POST_CONTENT_CONFIG = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'br', 'p', 'ul', 'ol', 'li', 'code', 'pre'],
  ALLOWED_ATTR: ['href', 'rel', 'target'],
  ALLOW_DATA_ATTR: false,
};

// Flag to gate the hook — only active during sanitizePostContent calls.
// Avoids addHook/removeHooks churn and the sledgehammer of removeHooks
// which would destroy hooks registered by other code.
let _inPostContentSanitize = false;

// Registered once at module load. Only does work when _inPostContentSanitize is true,
// so sanitizePlainText and other callers pass through untouched.
DOMPurify.addHook('afterSanitizeAttributes', node => {
  if (!_inPostContentSanitize) return;
  if (node.tagName === 'A') {
    node.setAttribute('rel', 'noopener noreferrer');
    node.setAttribute('target', '_blank');

    // Validate href via sanitizeUrl logic
    const href = node.getAttribute('href') || '';
    const cleanHref = sanitizeUrl(href);
    if (cleanHref === '') {
      // Dangerous or invalid href — remove the node entirely
      node.removeAttribute('href');
      // Replace anchor with its text content
      const text = node.textContent || '';
      if (node.parentNode) {
        node.parentNode.replaceChild(node.ownerDocument!.createTextNode(text), node);
      }
    } else {
      node.setAttribute('href', cleanHref);
    }
  }
});

/**
 * Sanitize post content - allows basic formatting, strips dangerous elements
 */
export function sanitizePostContent(content: string): string {
  if (!content) return '';
  _inPostContentSanitize = true;
  try {
    return DOMPurify.sanitize(content, POST_CONTENT_CONFIG).trim();
  } finally {
    _inPostContentSanitize = false;
  }
}

/**
 * Sanitize plain text - strips all HTML, returns plain text only
 * Use for usernames, display names, bios, etc.
 */
export function sanitizePlainText(text: string): string {
  if (!text) return '';
  // Use DOMPurify with no allowed tags to safely strip all HTML
  // (regex-based stripping is bypassable with malformed/nested tags)
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] }).trim();
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
