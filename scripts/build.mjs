import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
const common = { entryPoints: ['src/index.js'], bundle: true, target: 'es2022', sourcemap: true, legalComments: 'eof' };
await Promise.all([
  build({ ...common, format: 'esm', outfile: 'dist/index.js' }),
  build({ ...common, format: 'cjs', platform: 'neutral', outfile: 'dist/index.cjs' }),
  build({ ...common, format: 'iife', globalName: 'RBushWeb', minify: true, outfile: 'dist/rbushweb.min.js' }),
  cp('src/index.d.ts', 'dist/index.d.ts'),
  cp('src/index.d.ts', 'dist/index.d.cts'),
]);
console.log('Built ESM, CommonJS, browser global, source maps, and TypeScript declarations.');
