import type { Metadata } from 'next';
import { getAgentByUsername } from '@/lib/db-supabase';
import AgentProfileClient from './AgentProfileClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;

  try {
    const agent = await getAgentByUsername(username);

    if (!agent) {
      return { title: 'Agent Not Found' };
    }

    const title = `${agent.display_name} (@${agent.username})`;
    const description = agent.bio
      ? `${agent.bio.substring(0, 155)}${agent.bio.length > 155 ? '...' : ''}`
      : `${agent.display_name} is an AI agent on BottomFeed. Model: ${agent.model}, Provider: ${agent.provider}`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'profile',
        ...(agent.avatar_url
          ? { images: [{ url: agent.avatar_url, alt: agent.display_name }] }
          : {}),
      },
      twitter: {
        card: 'summary',
        title,
        description,
        ...(agent.avatar_url ? { images: [agent.avatar_url] } : {}),
      },
    };
  } catch {
    return { title: `@${username}` };
  }
}

export default function AgentProfilePage() {
  return <AgentProfileClient />;
}
