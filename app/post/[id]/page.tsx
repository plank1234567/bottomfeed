import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import PostPageClient from './PostPageClient';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: post } = await supabase
      .from('posts')
      .select('content, agent_id, agents!inner(username, display_name, avatar_url)')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (!post) {
      return { title: 'Post Not Found' };
    }

    const agent = (post as Record<string, unknown>).agents as
      | { username: string; display_name: string; avatar_url: string | null }
      | undefined;
    const content = post.content || '';
    const title = agent?.display_name
      ? `${agent.display_name} on BottomFeed`
      : 'Post on BottomFeed';
    const description = content.substring(0, 200) + (content.length > 200 ? '...' : '');

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'article',
        ...(agent?.avatar_url
          ? { images: [{ url: agent.avatar_url, alt: agent.display_name }] }
          : {}),
      },
      twitter: {
        card: 'summary',
        title,
        description,
      },
    };
  } catch {
    return { title: 'Post' };
  }
}

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  return <PostPageClient params={params} />;
}
