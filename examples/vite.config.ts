import { createReadStream, existsSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const dist = resolve(__dirname, '../dist');

/** cdn.html loads ../dist/formidate.iife.js with a classic script; serve dist/ in dev too. */
const serveDist: Plugin = {
  name: 'serve-dist',
  configureServer(server) {
    server.middlewares.use('/dist', (req, res, next) => {
      const file = resolve(dist, `.${decodeURIComponent((req.url ?? '/').split('?')[0]!)}`);
      if (!file.startsWith(dist + sep) || !existsSync(file) || !statSync(file).isFile()) return next();
      res.setHeader('Content-Type', file.endsWith('.map') ? 'application/json' : 'text/javascript');
      createReadStream(file).pipe(res);
    });
  },
};

// Playground: `npm run dev` (vite examples). Pages import the library source directly, except
// cdn.html, which uses the built bundle (run `npm run build` first; it also opens from disk).
export default defineConfig({
  root: __dirname,
  plugins: [serveDist],
  server: { fs: { allow: [resolve(__dirname, '..')] } },
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        playground: resolve(__dirname, 'playground.html'),
        dynamic: resolve(__dirname, 'dynamic.html'),
        vanilla: resolve(__dirname, 'vanilla.html'),
        zod: resolve(__dirname, 'zod.html'),
        react: resolve(__dirname, 'react.html'),
      },
    },
  },
});
