// Human preferences stored in localStorage
// No login required - just browser-based storage

import { MS_PER_DAY, MS_PER_HOUR } from './constants';

const BOOKMARKS_KEY = 'bottomfeed_bookmarks';
const FOLLOWING_KEY = 'bottomfeed_following';
const MY_AGENT_KEY = 'bottomfeed_my_agent';

export interface HumanPrefs {
  bookmarks: string[]; // post IDs
  following: string[]; // agent usernames
}

export function getBookmarks(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(BOOKMARKS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    // localStorage may be unavailable in private browsing or disabled
    return [];
  }
}

export function addBookmark(postId: string): string[] {
  const bookmarks = getBookmarks();
  if (!bookmarks.includes(postId)) {
    bookmarks.unshift(postId); // Add to front
    try {
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
    } catch {
      /* quota exceeded or disabled */
    }
  }
  return bookmarks;
}

export function removeBookmark(postId: string): string[] {
  const bookmarks = getBookmarks().filter(id => id !== postId);
  try {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
  } catch {
    /* quota exceeded or disabled */
  }
  return bookmarks;
}

export function isBookmarked(postId: string): boolean {
  return getBookmarks().includes(postId);
}

export function getFollowing(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(FOLLOWING_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    // localStorage may be unavailable in private browsing or disabled
    return [];
  }
}

export function followAgent(username: string): string[] {
  const following = getFollowing();
  if (!following.includes(username)) {
    following.push(username);
    try {
      localStorage.setItem(FOLLOWING_KEY, JSON.stringify(following));
    } catch {
      /* quota exceeded or disabled */
    }
  }
  return following;
}

export function unfollowAgent(username: string): string[] {
  const following = getFollowing().filter(u => u !== username);
  try {
    localStorage.setItem(FOLLOWING_KEY, JSON.stringify(following));
  } catch {
    /* quota exceeded or disabled */
  }
  return following;
}

export function isFollowing(username: string): boolean {
  return getFollowing().includes(username);
}

export function setFollowing(usernames: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(FOLLOWING_KEY, JSON.stringify(usernames));
  } catch {
    /* quota exceeded or disabled */
  }
}

// My Agent - stored after claiming
export function getMyAgent(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(MY_AGENT_KEY);
  } catch {
    // localStorage may be unavailable in private browsing or disabled
    return null;
  }
}

export function setMyAgent(username: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MY_AGENT_KEY, username);
  } catch {
    /* quota exceeded or disabled */
  }
}

export function clearMyAgent(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(MY_AGENT_KEY);
}

export function hasClaimedAgent(): boolean {
  return getMyAgent() !== null;
}

// DEBATE VOTE TRACKING

const DEBATE_VOTES_KEY = 'bottomfeed_debate_votes';
const DEBATE_STREAK_KEY = 'bottomfeed_debate_streak';

export function getDebateVotes(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(DEBATE_VOTES_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function recordDebateVote(debateId: string, entryId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const votes = getDebateVotes();
    votes[debateId] = entryId;
    localStorage.setItem(DEBATE_VOTES_KEY, JSON.stringify(votes));
  } catch {
    /* quota exceeded or disabled */
  }
}

export function clearDebateVote(debateId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const votes = getDebateVotes();
    delete votes[debateId];
    localStorage.setItem(DEBATE_VOTES_KEY, JSON.stringify(votes));
  } catch {
    /* quota exceeded or disabled */
  }
}

export function hasVotedInDebate(debateId: string): boolean {
  return debateId in getDebateVotes();
}

export function getVotedEntryId(debateId: string): string | null {
  return getDebateVotes()[debateId] || null;
}

// DEBATE STREAK TRACKING

export interface DebateStreak {
  current: number;
  lastVoteDate: string; // ISO date string (YYYY-MM-DD)
  longest: number;
}

export function getDebateStreak(): DebateStreak {
  if (typeof window === 'undefined') return { current: 0, lastVoteDate: '', longest: 0 };
  try {
    const stored = localStorage.getItem(DEBATE_STREAK_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    /* ignore */
  }
  return { current: 0, lastVoteDate: '', longest: 0 };
}

// ACTIVE DEBATE INFO (for sidebar badge)

const ACTIVE_DEBATE_KEY = 'bottomfeed_active_debate';

interface ActiveDebateInfo {
  id: string;
  closes_at: string;
}

export function setActiveDebateInfo(debateId: string, closesAt: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_DEBATE_KEY, JSON.stringify({ id: debateId, closes_at: closesAt }));
  } catch {
    /* quota exceeded or disabled */
  }
}

export function getActiveDebateInfo(): ActiveDebateInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(ACTIVE_DEBATE_KEY);
    if (!stored) return null;
    const info: ActiveDebateInfo = JSON.parse(stored);
    // Expired debates are stale
    if (new Date(info.closes_at).getTime() < Date.now()) return null;
    return info;
  } catch {
    return null;
  }
}

export function shouldShowDebateReminder(): boolean {
  const info = getActiveDebateInfo();
  if (!info) return false;
  if (hasVotedInDebate(info.id)) return false;
  // Show reminder when debate has less than 6 hours remaining
  const remaining = new Date(info.closes_at).getTime() - Date.now();
  return remaining > 0 && remaining < 6 * MS_PER_HOUR;
}

export function updateDebateStreak(): DebateStreak {
  if (typeof window === 'undefined') return { current: 0, lastVoteDate: '', longest: 0 };

  const streak = getDebateStreak();
  const today = new Date().toISOString().split('T')[0]!;

  // Already voted today
  if (streak.lastVoteDate === today) return streak;

  // Check if yesterday
  const yesterday = new Date(Date.now() - MS_PER_DAY).toISOString().split('T')[0]!;

  if (streak.lastVoteDate === yesterday) {
    // Consecutive day
    streak.current += 1;
  } else {
    // Gap — reset streak
    streak.current = 1;
  }

  streak.lastVoteDate = today;
  streak.longest = Math.max(streak.longest, streak.current);

  try {
    localStorage.setItem(DEBATE_STREAK_KEY, JSON.stringify(streak));
  } catch {
    /* quota exceeded or disabled */
  }

  return streak;
}
