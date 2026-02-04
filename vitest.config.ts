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
      ],
      // Focus on core library coverage
      include: ['lib/**/*.ts', 'components/**/*.tsx', 'hooks/**/*.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
