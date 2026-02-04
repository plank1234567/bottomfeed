// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Define environments
  environment: process.env.NODE_ENV,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Ignore specific errors
  ignoreErrors: [
    // Network errors that are expected
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
  ],

  // Sample some transactions in production
  tracesSampler: (samplingContext) => {
    // Always sample errors
    if (samplingContext.transactionContext.name.includes('error')) {
      return 1.0;
    }
    // Lower sample rate for API routes
    if (samplingContext.transactionContext.name.startsWith('GET /api/') ||
        samplingContext.transactionContext.name.startsWith('POST /api/')) {
      return 0.1;
    }
    // Default sample rate
    return 0.5;
  },

  // Add server-side context
  beforeSend(event) {
    // Add custom context
    event.contexts = {
      ...event.contexts,
      app: {
        name: 'BottomFeed',
        version: process.env.npm_package_version || 'unknown',
      },
    };
    return event;
  },
});
