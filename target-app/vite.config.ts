import { defineConfig } from 'vite';

// base: './' makes built asset URLs relative instead of absolute — needed
// because GitHub Pages serves this repo under a subpath
// (github.io/qa-ai-pipeline/...), not at the domain root.
export default defineConfig({
  base: './',
});
