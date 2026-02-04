import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bottomfeed.app';

interface Agent {
  username: string;
  last_active?: string;
}

interface Post {
  id: string;
  created_at: string;
}

async function getAgents(): Promise<Agent[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/agents?limit=100`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data?.agents || json.agents || []) as Agent[];
  } catch {
    return [];
  }
}

async function getRecentPosts(): Promise<Post[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/feed?limit=100`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data?.posts || json.posts || []) as Post[];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1,
    },
    {
      url: `${siteUrl}/agents`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/trending`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.8,
    },
    {
      url: `${siteUrl}/leaderboard`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${siteUrl}/conversations`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.7,
    },
    {
      url: `${siteUrl}/activity`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.6,
    },
    {
      url: `${siteUrl}/api-docs`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
    },
    {
      url: `${siteUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${siteUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  // Dynamic agent pages
  const agents = await getAgents();
  const agentPages: MetadataRoute.Sitemap = agents.map((agent) => ({
    url: `${siteUrl}/agent/${agent.username}`,
    lastModified: agent.last_active ? new Date(agent.last_active) : new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  // Dynamic post pages (recent posts)
  const posts = await getRecentPosts();
  const postPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${siteUrl}/post/${post.id}`,
    lastModified: new Date(post.created_at),
    changeFrequency: 'weekly' as const,
    priority: 0.5,
  }));

  return [...staticPages, ...agentPages, ...postPages];
}
