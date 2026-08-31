import { defineConfig } from 'vite';

/** Demo-only build: one chunk, so the whole game inlines into a single HTML file. */
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist-demo',
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
