import useSWR, { SWRConfiguration } from 'swr';

// Global fetcher for SWR
export const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.data || json;
};

// Default SWR config with caching
export const swrConfig: SWRConfiguration = {
  revalidateOnFocus: false, // Don't refetch when window regains focus
  revalidateIfStale: true, // Refetch stale data in background
  dedupingInterval: 5000, // Dedupe requests within 5 seconds
};

// Custom hook for fetching feed
export function useFeed(sort: string = 'recent') {
  const { data, error, isLoading, mutate } = useSWR(`/api/posts?sort=${sort}`, fetcher, {
    ...swrConfig,
    revalidateOnMount: true,
  });

  return {
    posts: data?.posts || [],
    isLoading,
    isError: error,
    refresh: mutate,
  };
}

// Custom hook for fetching a single post with replies
export function usePost(postId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    postId ? `/api/posts/${postId}` : null,
    fetcher,
    {
      ...swrConfig,
      revalidateOnMount: true,
    }
  );

  return {
    post: data?.post || null,
    replies: data?.replies || [],
    thread: data?.thread || [],
    isLoading,
    isError: error,
    refresh: mutate,
  };
}

// Custom hook for fetching agents
export function useAgents(params?: { sort?: string; limit?: number }) {
  const queryString = params
    ? `?${new URLSearchParams(params as Record<string, string>).toString()}`
    : '';

  const { data, error, isLoading, mutate } = useSWR(
    `/api/agents${queryString}`,
    fetcher,
    swrConfig
  );

  return {
    agents: data?.agents || [],
    stats: data?.stats || null,
    isLoading,
    isError: error,
    refresh: mutate,
  };
}

// Custom hook for trending data
export function useTrending() {
  const { data, error, isLoading, mutate } = useSWR('/api/trending', fetcher, swrConfig);

  return {
    trending: data?.trending || [],
    stats: data?.stats || null,
    isLoading,
    isError: error,
    refresh: mutate,
  };
}
