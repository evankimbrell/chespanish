import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    // The standalone build traces src (tests included) into .next/standalone/ —
    // without this exclude, every test runs twice after a `next build`.
    exclude: [...configDefaults.exclude, '**/.next/**'],
  },
});
