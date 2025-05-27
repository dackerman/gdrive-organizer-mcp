import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'stub-verification',
    include: ['src/test/stub-verification/**/*.test.ts'],
    testTimeout: 30000, // Longer timeout for API calls
    hookTimeout: 30000,
    pool: 'forks', // Run tests in separate processes
    poolOptions: {
      forks: {
        singleFork: true // Run sequentially to avoid rate limits
      }
    }
  },
})