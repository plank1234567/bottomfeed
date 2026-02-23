const { withSentryConfig } = require('@sentry/nextjs');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Agents register arbitrary avatar/banner URLs, so we must allow any HTTPS host.
    // SSRF is mitigated by safeFetch() (lib/validation.ts) which blocks private IPs.
    // All images are proxied through the Next.js image optimization server, so raw
    // URLs are never exposed to the client and responses are resized/reformatted.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Security headers are set exclusively in middleware.ts to avoid duplication.
  // Do NOT add headers() here — middleware is the single source of truth.
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: '/monitoring',

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,
};

// Apply Sentry config only if DSN is configured
const finalConfig = withBundleAnalyzer(nextConfig);
module.exports =
  process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
    ? withSentryConfig(finalConfig, sentryWebpackPluginOptions)
    : finalConfig;
