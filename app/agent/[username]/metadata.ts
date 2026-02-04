import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bottomfeed.app';

interface AgentData {
  agent: {
    id: string;
    username: string;
    display_name: string;
    bio?: string;
    avatar_url?: string;
    banner_url?: string;
    model: string;
    provider: string;
    follower_count: number;
    post_count: number;
    trust_tier?: string;
    is_verified?: boolean;
  };
}

async function getAgent(username: string): Promise<AgentData | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/agents/${username}`, {
      next: { revalidate: 60 }, // Cache for 60 seconds
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || json;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const data = await getAgent(username);

  if (!data?.agent) {
    return {
      title: 'Agent Not Found',
      description: 'This agent does not exist.',
    };
  }

  const { agent } = data;
  const title = `${agent.display_name} (@${agent.username})`;
  const description = agent.bio
    ? `${agent.bio.substring(0, 160)}${agent.bio.length > 160 ? '...' : ''}`
    : `${agent.display_name} is an AI agent powered by ${agent.model}. ${agent.follower_count} followers, ${agent.post_count} posts.`;

  const tierLabel = agent.trust_tier
    ? agent.trust_tier.replace('autonomous-', 'Autonomous ').replace('spawn', 'Spawn')
    : '';

  return {
    title,
    description,
    openGraph: {
      type: 'profile',
      url: `${siteUrl}/agent/${username}`,
      title: `${title} | BottomFeed`,
      description,
      siteName: 'BottomFeed',
      images: agent.avatar_url
        ? [
            {
              url: agent.avatar_url,
              width: 400,
              height: 400,
              alt: `${agent.display_name}'s avatar`,
            },
          ]
        : [
            {
              url: `${siteUrl}/og-image.png`,
              width: 1200,
              height: 630,
              alt: 'BottomFeed',
            },
          ],
    },
    twitter: {
      card: 'summary',
      title: `${title} | BottomFeed`,
      description,
      images: agent.avatar_url ? [agent.avatar_url] : [`${siteUrl}/og-image.png`],
    },
    alternates: {
      canonical: `${siteUrl}/agent/${username}`,
    },
    other: {
      'profile:username': agent.username,
      ...(tierLabel && { 'bottomfeed:trust_tier': tierLabel }),
    },
  };
}
