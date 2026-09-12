import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import vm from 'node:vm';

const project = resolve('.');
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
function run(command, args, cwd = project) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 180_000, env: { ...process.env, NODE_AUTH_TOKEN: '', NPM_TOKEN: '' } });
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}\n${result.error || ''}`);
  return result.stdout;
}
const flag = process.argv.indexOf('--tarball');
let tarball;
if (flag >= 0) {
  assert(process.argv[flag + 1], '--tarball needs a filename');
  tarball = resolve(process.argv[flag + 1]);
} else {
  run(npm, ['run', 'build']);
  const packed = JSON.parse(run(npm, ['pack', '--ignore-scripts', '--json']))[0];
  tarball = resolve(packed.filename);
  for (const file of ['dist/index.js', 'dist/index.cjs', 'dist/index.d.ts', 'dist/index.d.cts', 'dist/rbushweb.min.js', 'src/index.js', 'LICENSE', 'NOTICE']) {
    assert(packed.files.some(entry => entry.path === file), `Missing packaged ${file}`);
  }
  assert(!packed.files.some(entry => entry.path.startsWith('node_modules/')), 'Do not bundle development dependencies');
}
const directory = await mkdtemp(join(tmpdir(), 'rbushweb-consumer-'));
try {
  await writeFile(join(directory, 'package.json'), JSON.stringify({ name: 'rbushweb-consumer', version: '1.0.0', private: true, type: 'module' }));
  run(npm, ['install', tarball, '--offline', '--ignore-scripts', '--no-audit', '--no-fund'], directory);
  const checks = `
const points = Array.from({length: 120}, (_, id) => ({id, Envelope: new Envelope(id, id, id, id)}));
const tree = new RBush(9); tree.BulkLoad(points);
assert.equal(tree.Count, 120);
assert.equal(tree.Search(new Envelope(10,10,20,20)).length, 11);
assert.equal(tree.Knn(1,15.1,15.1)[0].id, 15);
assert.equal(tree.Delete(points[15]), true);
assert.equal(tree.Count, 119);
assert.equal(tree.Delete(points[15]), false);
tree.Clear(); assert.equal(tree.Search().length, 0);
`;
  const esm = `import assert from 'node:assert/strict'; import RBushDefault, { RBush, Envelope, RBushExtensions } from '${pkg.name}'; assert.equal(RBushDefault, RBush); assert.equal(typeof RBushExtensions.Knn, 'function'); ${checks}`;
  await writeFile(join(directory, 'consumer.mjs'), esm);
  run(process.execPath, ['consumer.mjs'], directory);
  await writeFile(join(directory, 'consumer.cjs'), `const assert = require('node:assert/strict'); const { RBush, Envelope } = require('${pkg.name}'); ${checks}`);
  run(process.execPath, ['consumer.cjs'], directory);
  const declarations = `import { RBush, Envelope, type ISpatialData, type ISpatialIndex, type ISpatialDatabase } from '${pkg.name}';\ninterface Point extends ISpatialData { id: number; }\nconst point: Point = { id: 1, Envelope: new Envelope(1, 2, 1, 2) };\nconst tree = new RBush<Point>(9);\nconst db: ISpatialDatabase<Point> = tree;\nconst index: ISpatialIndex<Point> = db;\ndb.BulkLoad([point]);\nconst result: readonly Point[] = index.Search(point.Envelope);\nconst removed: boolean = db.Delete(point);\nconst nearest: readonly Point[] = tree.Knn(1, 0, 0);\n// @ts-expect-error id is required\ntree.Insert({ Envelope: point.Envelope });\nvoid [result, removed, nearest];\n`;
  await writeFile(join(directory, 'consumer.mts'), declarations);
  await writeFile(join(directory, 'consumer.cts'), declarations);
  run(process.execPath, [join(project, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', 'consumer.mts', 'consumer.cts'], directory);
  const script = await readFile(join(directory, 'node_modules', pkg.name, 'dist/rbushweb.min.js'), 'utf8');
  const context = vm.createContext({});
  vm.runInContext(script, context);
  assert.equal(vm.runInContext('(() => { const {RBush, Envelope} = RBushWeb; const tree = new RBush(); tree.Insert({Envelope:new Envelope(0,0,1,1)}); return tree.Search(new Envelope(1,1,2,2)).length; })()', context), 1);
  console.log(`Package verified: installed ESM, CommonJS, strict TypeScript ESM/CJS, and browser global consumers for ${pkg.name}@${pkg.version}.`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
