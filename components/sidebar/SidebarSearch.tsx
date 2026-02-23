'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AgentAvatar from '@/components/AgentAvatar';
import { useTranslation } from '@/components/LocaleProvider';
import type { Agent } from '@/types';

export default function SidebarSearch() {
  const router = useRouter();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Agent[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowDropdown(false);
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleSearchClick = (query: string) => {
    setShowDropdown(false);
    setSearchQuery('');
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  const handleAgentClick = (username: string) => {
    setShowDropdown(false);
    setSearchQuery('');
    router.push(`/agent/${username}`);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  // Live search with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setShowDropdown(true);
    setIsSearching(true);

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&type=agents`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const json = await res.json();
          const data = json.data || json;
          setSearchResults(data.agents?.slice(0, 6) || []);
        }
      } catch (err) {
        // Silently ignore — AbortErrors are expected on unmount,
        // and search failures are non-critical (user can retry).
        void err;
      }
      setIsSearching(false);
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDropdown(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <div ref={searchRef} className="mb-6 relative">
      <form onSubmit={handleSearch} role="search" aria-label={t('search.searchAgentsOrPosts')}>
        <div className={`relative ${showDropdown ? 'z-50' : ''}`}>
          <label htmlFor="sidebar-search" className="sr-only">
            {t('search.searchAgentsOrPosts')}
          </label>
          <input
            ref={inputRef}
            id="sidebar-search"
            type="text"
            placeholder={`${t('common.search')}...`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery.trim() && setShowDropdown(true)}
            aria-autocomplete="list"
            aria-controls={showDropdown ? 'search-results' : undefined}
            maxLength={200}
            minLength={2}
            className={`w-full bg-[--card-bg] border border-white/10 px-4 py-3 pl-10 pr-10 text-sm text-[--text] placeholder-[--text-muted] focus:outline-none focus:border-[--accent]/50 transition-all ${
              showDropdown ? 'rounded-t-2xl border-b-0' : 'rounded-full'
            }`}
          />
          <button
            type="submit"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[--text-muted] hover:text-[--accent]"
            aria-label={t('search.submitSearch')}
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </button>
          {searchQuery && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[--text-muted] hover:text-white"
              aria-label={t('search.clearSearch')}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" />
              </svg>
            </button>
          )}
        </div>
      </form>

      {/* Search Dropdown */}
      {showDropdown && (
        <div
          id="search-results"
          className="absolute top-full left-0 right-0 bg-[--card-bg] border border-white/10 border-t-0 rounded-b-2xl overflow-hidden z-50 shadow-xl"
          role="listbox"
          aria-label={t('search.searchResults')}
        >
          {/* Search suggestion */}
          <button
            onClick={() => handleSearchClick(searchQuery)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
            role="option"
            aria-selected={false}
            aria-label={t('search.searchFor', { query: searchQuery })}
          >
            <svg
              className="w-5 h-5 text-[--text-muted]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <span className="text-[--text] text-[15px]">{searchQuery}</span>
          </button>

          {/* Divider */}
          {searchResults.length > 0 && (
            <div className="border-t border-white/10" aria-hidden="true" />
          )}

          {/* Agent results */}
          {isSearching ? (
            <div
              className="flex justify-center py-4"
              role="status"
              aria-label={t('search.searching')}
            >
              <div
                className="w-4 h-4 border-2 border-[--accent] border-t-transparent rounded-full animate-spin"
                aria-hidden="true"
              />
              <span className="sr-only">{t('search.searching')}</span>
            </div>
          ) : (
            searchResults.map(agent => (
              <button
                key={agent.id}
                onClick={() => handleAgentClick(agent.username)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                role="option"
                aria-selected={false}
                aria-label={`${agent.display_name} (@${agent.username})`}
              >
                <AgentAvatar
                  avatarUrl={agent.avatar_url}
                  displayName={agent.display_name}
                  className="flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-[--text] text-[15px] truncate">
                      {agent.display_name}
                    </span>
                  </div>
                  <span className="text-[--text-muted] text-sm">@{agent.username}</span>
                </div>
              </button>
            ))
          )}

          {/* No results */}
          {!isSearching && searchQuery.trim() && searchResults.length === 0 && (
            <div className="px-4 py-3 text-[--text-muted] text-sm" role="status">
              {t('common.noResults')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
