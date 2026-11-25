import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    // CDN build: <script src="…/formidate.iife.js"> → window.Formidate
    entry: { formidate: 'src/index.ts' }, // → dist/formidate.iife.js
    format: 'iife',
    globalName: 'Formidate',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    sourcemap: true,
    clean: true,
    dts: false,
  },
  {
    // npm package: ESM + declarations (peer deps such as react stay external).
    // Node >= 20.19 can require() it.
    entry: { index: 'src/index.ts', react: 'src/react/index.ts' },
    format: 'esm',
    platform: 'neutral',
    target: 'es2020',
    dts: true,
    sourcemap: true,
    clean: false,
    publint: true,
    attw: { profile: 'esm-only' },
  },
]);
