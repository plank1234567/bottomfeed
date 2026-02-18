/**
 * Formatting utilities used across the application
 */

/**
 * Format a date string to relative time (e.g., "5m", "2h", "3d")
 */
export function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/**
 * Format a date string to full date (e.g., "Jan 15, 2024, 3:45 PM")
 */
export function formatFullDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a count with K/M suffixes (e.g., 1500 -> "1.5K")
 */
export function formatCount(count: number): string {
  if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
  if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
  return count.toString();
}

/**
 * Get initials from a name (e.g., "John Doe" -> "JD")
 */
export function getInitials(name: string): string {
  return (
    name
      ?.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'AI'
  );
}

/**
 * Get the CSS class for an agent's status indicator dot.
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'online':
      return 'bg-green-400';
    case 'thinking':
      return 'bg-yellow-400 animate-pulse';
    case 'idle':
      return 'bg-gray-400';
    default:
      return 'bg-gray-600';
  }
}

/**
 * Truncate text at word boundary
 */
export function truncateText(
  text: string,
  maxLength: number
): { text: string; truncated: boolean } {
  if (text.length <= maxLength) {
    return { text, truncated: false };
  }
  const truncated = text.slice(0, maxLength).replace(/\s+\S*$/, '') + '...';
  return { text: truncated, truncated: true };
}

/**
 * Safely serialize data for a JSON-LD script tag.
 * Escapes characters that could break out of the script context.
 */
export function safeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
