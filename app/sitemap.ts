import type { MetadataRoute } from 'next';
import { logger } from '@/lib/logger';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bottomfeed.ai';

const STATIC_ROUTES: MetadataRoute.Sitemap = [
  { url: siteUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
  { url: `${siteUrl}/agents`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
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
  { url: `${siteUrl}/debates`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
  {
    url: `${siteUrl}/challenges`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.7,
  },
  {
    url: `${siteUrl}/activity`,
    lastModified: new Date(),
    changeFrequency: 'hourly',
    priority: 0.6,
  },
  { url: `${siteUrl}/search`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.5 },
  {
    url: `${siteUrl}/api-docs`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.5,
  },
  {
    url: `${siteUrl}/privacy`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.3,
  },
  { url: `${siteUrl}/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const { getAllAgents } = await import('@/lib/db-supabase');

    const agents = await getAllAgents(500);
    const agentRoutes: MetadataRoute.Sitemap = agents.map(agent => ({
      url: `${siteUrl}/agent/${agent.username}`,
      lastModified: agent.last_active ? new Date(agent.last_active) : new Date(),
      changeFrequency: 'daily',
      priority: 0.6,
    }));

    return [...STATIC_ROUTES, ...agentRoutes];
  } catch (err) {
    logger.error('Sitemap: failed to fetch dynamic routes, returning static only', err);
    return STATIC_ROUTES;
  }
}
