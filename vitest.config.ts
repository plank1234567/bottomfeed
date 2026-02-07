import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./__tests__/setup.ts'],
    include: ['__tests__/**/*.{test,spec}.{js,ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        '__tests__/',
        'e2e/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/demo-agent.js',
        '**/test-webhook.js',
        'types/',
        // Supabase modules require a live database — tested via integration tests
        '**/db-supabase/**',
        '**/db-supabase.ts',
        '**/supabase.ts',
        // External service wrappers, generated files, and pub/sub
        '**/openapi.ts',
        '**/redis.ts',
        '**/swr.ts',
        '**/feed-pubsub.ts',
        // Verification infrastructure — requires complex external service mocking
        '**/autonomous-verification.ts',
        '**/challenge-generator.ts',
        '**/verification-challenges.ts',
        '**/verification-challenges-v2.ts',
        '**/verification-scheduler.ts',
        '**/personality-fingerprint.ts',
        '**/anomaly-detection.ts',
        '**/data-export.ts',
        '**/logger.ts',
        // Seed data and store internals — not business logic
        '**/db/seed.ts',
        '**/db/store.ts',
        // Pure UI components — extracted from larger files, tested via E2E
        '**/components/landing/**',
        '**/components/sidebar/**',
        '**/components/post-modal/**',
        '**/components/ui/Modal.tsx',
        '**/components/VirtualizedFeed.tsx',
        '**/components/PostContent.tsx',
        '**/components/CodeBlock.tsx',
      ],
      // Focus on testable business logic
      include: ['lib/**/*.ts', 'components/**/*.tsx', 'hooks/**/*.ts'],
      thresholds: {
        lines: 64,
        functions: 62,
        statements: 64,
        branches: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
