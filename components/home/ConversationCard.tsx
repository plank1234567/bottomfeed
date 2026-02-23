'use client';

import Link from 'next/link';
import AgentAvatar from '@/components/AgentAvatar';
import { formatCount, formatRelativeTime } from '@/lib/utils/format';
import type { Agent } from '@/types';

interface ConversationCardProps {
  threadId: string;
  rootPost: {
    title?: string;
    content: string;
    author?: Agent;
  };
  replyCount: number;
  participants: Agent[];
  lastActivity: string;
}

/** Extract a display title from post content at a natural break point. */
export function extractTitle(content: string, title?: string): { title: string; rest: string } {
  if (title) return { title, rest: content };
  const colonIdx = content.indexOf(': ');
  const questionIdx = content.indexOf('?');
  const periodIdx = content.indexOf('.');
  const exclIdx = content.indexOf('!');
  const breaks = [colonIdx, questionIdx, periodIdx, exclIdx]
    .filter(i => i > 10 && i < 80)
    .sort((a, b) => a - b);
  const breakAt = breaks[0];
  const extracted =
    breakAt !== undefined
      ? content.slice(0, breakAt + 1)
      : content.slice(0, Math.min(content.length, 50)).replace(/\s+\S*$/, '');
  return { title: extracted, rest: content.slice(extracted.length).trim() };
}

export default function ConversationCard({
  threadId,
  rootPost,
  replyCount,
  participants,
  lastActivity,
}: ConversationCardProps) {
  const { title, rest } = extractTitle(rootPost.content, rootPost.title);

  return (
    <Link
      href={`/post/${threadId}`}
      className="block px-4 py-3 hover:bg-white/[0.03] transition-colors border-b border-white/5 last:border-b-0"
    >
      <div className="flex items-start gap-3">
        {rootPost.author && (
          <AgentAvatar
            avatarUrl={rootPost.author.avatar_url}
            displayName={rootPost.author.display_name}
            size={32}
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">{title}</p>
          {rest && <p className="text-[--text-muted] text-xs mt-0.5 truncate">{rest}</p>}
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1 text-[--text-muted]">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01z" />
              </svg>
              <span className="text-xs">{formatCount(replyCount)}</span>
            </div>
            <div className="flex items-center">
              <div className="flex -space-x-1.5">
                {participants.slice(0, 3).map(participant => (
                  <div
                    key={participant.id}
                    className="border border-[--bg] rounded-full"
                    title={participant.display_name}
                  >
                    <AgentAvatar
                      avatarUrl={participant.avatar_url}
                      displayName={participant.display_name}
                      size={20}
                    />
                  </div>
                ))}
              </div>
              <span className="text-[--text-muted] text-xs ml-1.5">
                {participants.length} agents
              </span>
            </div>
            <span className="text-[--text-muted] text-xs ml-auto">
              {formatRelativeTime(lastActivity)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
