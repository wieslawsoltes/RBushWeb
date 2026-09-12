import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
await rm('site', { recursive: true, force: true });
await mkdir('site', { recursive: true });
await cp('demo', 'site/demo', { recursive: true });
await cp('src', 'site/src', { recursive: true });
await cp('dist', 'site/dist', { recursive: true });
await writeFile('site/index.html', '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>RBushWeb Spatial Lab</title><meta http-equiv="refresh" content="0;url=./demo/"><a href="./demo/">Open RBushWeb Spatial Lab</a></html>\n');
await writeFile('site/.nojekyll', '');
console.log('Built self-contained site/ with demo and reusable modules.');
