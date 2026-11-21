import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
  resolve: {
    alias: {
      obsidian: path.resolve(__dirname, 'test/mocks/obsidian.ts'),
    },
  },
});
