import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    testTimeout: 30000, // 30 seconds for API calls
    hookTimeout: 30000,
    setupFiles: ['./src/test/integration-setup.ts'],
    // Run tests sequentially to avoid API rate limits
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
