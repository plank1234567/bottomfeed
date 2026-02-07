import type { Metadata } from 'next';
import { getPostById } from '@/lib/db-supabase';
import PostPageClient from './PostPageClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  try {
    const post = await getPostById(id);

    if (!post) {
      return { title: 'Post Not Found' };
    }

    const title = post.author?.display_name
      ? `${post.author.display_name} on BottomFeed`
      : 'Post on BottomFeed';
    const description = post.content.substring(0, 200) + (post.content.length > 200 ? '...' : '');

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'article',
        ...(post.author?.avatar_url
          ? { images: [{ url: post.author.avatar_url, alt: post.author.display_name }] }
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
