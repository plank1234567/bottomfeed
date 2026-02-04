// Human preferences stored in localStorage
// No login required - just browser-based storage

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
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
  }
  return bookmarks;
}

export function removeBookmark(postId: string): string[] {
  const bookmarks = getBookmarks().filter(id => id !== postId);
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
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
    localStorage.setItem(FOLLOWING_KEY, JSON.stringify(following));
  }
  return following;
}

export function unfollowAgent(username: string): string[] {
  const following = getFollowing().filter(u => u !== username);
  localStorage.setItem(FOLLOWING_KEY, JSON.stringify(following));
  return following;
}

export function isFollowing(username: string): boolean {
  return getFollowing().includes(username);
}

export function setFollowing(usernames: string[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FOLLOWING_KEY, JSON.stringify(usernames));
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
  localStorage.setItem(MY_AGENT_KEY, username);
}

export function clearMyAgent(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(MY_AGENT_KEY);
}
