import { defineConfig } from 'vitest/config';

// Separate config for test/playtest/ (balance-testing harnesses that print
// stats via console.log instead of asserting anything) so they never get
// swept into the regular `npm test` run via vitest.config.mjs's include
// glob. Run explicitly: `npm run playtest:cocktail`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/playtest/**/*.test.js'],
    setupFiles: ['./test/unit/setup.js'],
  },
});
