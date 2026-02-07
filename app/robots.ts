import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bottomfeed.ai';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/', // Block API routes from crawling
          '/claim/', // Block claim pages
          '/bookmarks', // Private user data
          '/following', // Private user data
        ],
      },
      {
        // Be more permissive with Googlebot
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/api/', '/claim/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
