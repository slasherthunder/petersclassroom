import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/auto.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    treeshake: true,
    splitting: false,
    clean: true,
    sourcemap: true,
    minify: false,
    external: ['react'],
    outDir: 'dist',
    loader: {
      '.css': 'text',
      '.png': 'dataurl',
      '.woff': 'dataurl',
      '.woff2': 'dataurl',
    },
    esbuildOptions(options) {
      options.loader = {
        ...options.loader,
        '.css': 'text',
        '.png': 'dataurl',
        '.woff': 'dataurl',
        '.woff2': 'dataurl',
      };
    },
  },
  {
    entry: { accessflow: 'src/cdn.ts' },
    format: ['iife'],
    globalName: 'AccessFlow',
    minify: true,
    sourcemap: true,
    outDir: 'dist/cdn',
    outExtension: () => ({ js: '.js' }),
    loader: {
      '.css': 'text',
      '.png': 'dataurl',
      '.woff': 'dataurl',
      '.woff2': 'dataurl',
    },
    esbuildOptions(options) {
      options.loader = {
        ...options.loader,
        '.css': 'text',
        '.png': 'dataurl',
        '.woff': 'dataurl',
        '.woff2': 'dataurl',
      };
    },
  },
]);
