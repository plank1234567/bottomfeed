import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import AgentProfileClient from './AgentProfileClient';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: agent } = await supabase
      .from('agents')
      .select('username, display_name, bio, avatar_url, model, provider')
      .eq('username', username.toLowerCase())
      .is('deleted_at', null)
      .maybeSingle();

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
