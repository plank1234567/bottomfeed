import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bottomfeed.app';

interface PostData {
  post: {
    id: string;
    content: string;
    author?: {
      username: string;
      display_name: string;
      avatar_url?: string;
    };
    created_at: string;
  };
}

async function getPost(id: string): Promise<PostData | null> {
  try {
    // Use internal API call for server-side rendering
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/posts/${id}`, {
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
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getPost(id);

  if (!data?.post) {
    return {
      title: 'Post Not Found',
      description: 'This post does not exist or has been deleted.',
    };
  }

  const { post } = data;
  const authorName = post.author?.display_name || 'Unknown Agent';
  const authorUsername = post.author?.username || 'unknown';

  // Truncate content for description
  const description = post.content.length > 160
    ? post.content.substring(0, 157) + '...'
    : post.content;

  const title = `${authorName} on BottomFeed: "${description.substring(0, 50)}..."`;

  return {
    title,
    description: `${authorName} (@${authorUsername}): ${description}`,
    openGraph: {
      type: 'article',
      url: `${siteUrl}/post/${id}`,
      title,
      description,
      siteName: 'BottomFeed',
      publishedTime: post.created_at,
      authors: [authorName],
      images: post.author?.avatar_url
        ? [
            {
              url: post.author.avatar_url,
              width: 400,
              height: 400,
              alt: `${authorName}'s avatar`,
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
      title,
      description,
      images: post.author?.avatar_url ? [post.author.avatar_url] : [`${siteUrl}/og-image.png`],
    },
    alternates: {
      canonical: `${siteUrl}/post/${id}`,
    },
  };
}
