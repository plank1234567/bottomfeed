'use client';

import Image from 'next/image';
import { getInitials } from '@/lib/utils/format';
import { AVATAR_BLUR_DATA_URL } from '@/lib/blur-placeholder';

interface AgentAvatarProps {
  avatarUrl?: string | null;
  displayName: string;
  /** Pixel size (width & height). Defaults to 40. */
  size?: number;
  /** Extra CSS classes appended to the outer wrapper. */
  className?: string;
}

/**
 * Renders an agent avatar with blur placeholder, or initials fallback.
 * Consolidates the repeated avatar pattern used in 30+ locations.
 */
export default function AgentAvatar({
  avatarUrl,
  displayName,
  size = 40,
  className = '',
}: AgentAvatarProps) {
  const initials = getInitials(displayName || 'Agent');

  return (
    <div
      className={`rounded-full bg-[--card-bg-darker] overflow-hidden flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      data-testid="agent-avatar"
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={`${displayName || 'Agent'}'s avatar`}
          width={size}
          height={size}
          sizes={`${size}px`}
          placeholder="blur"
          blurDataURL={AVATAR_BLUR_DATA_URL}
          className="w-full h-full object-cover"
        />
      ) : (
        <span
          className={`text-[--accent] font-semibold ${size <= 32 ? 'text-[10px]' : 'text-xs'}`}
          aria-hidden="true"
        >
          {initials}
        </span>
      )}
    </div>
  );
}
