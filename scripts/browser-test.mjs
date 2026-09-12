import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const projectRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
// RBUSH_DEMO_ROOT=site and RBUSH_DEMO_BASE_PATH=/RBushWeb/ exercise the Pages
// artifact and redirect. RBUSH_DEMO_URL tests a deployment without a server.
const root = path.resolve(projectRoot, process.env.RBUSH_DEMO_ROOT || '.');
const basePath = `/${(process.env.RBUSH_DEMO_BASE_PATH || '').replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/');
assert.equal(new URL(basePath, 'http://localhost').pathname, basePath, 'RBUSH_DEMO_BASE_PATH must be a URL path');
let demoUrl = process.env.RBUSH_DEMO_URL;
if (demoUrl) assert.ok(['http:', 'https:'].includes(new URL(demoUrl).protocol), 'RBUSH_DEMO_URL must use HTTP or HTTPS');
const screenshot = path.resolve(process.env.RBUSH_DEMO_SCREENSHOT || path.join(projectRoot, 'test-results', 'demo-desktop.png'));
await mkdir(path.dirname(screenshot), { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = demoUrl ? null : createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!pathname.startsWith(basePath)) { response.writeHead(404).end('Not found'); return; }
    let file = path.resolve(root, pathname.slice(basePath.length));
    if (file !== root && !file.startsWith(`${root}${path.sep}`)) { response.writeHead(403).end(); return; }
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    response.writeHead(200, { 'content-type': mime[path.extname(file)] ?? 'application/octet-stream' }); response.end(await readFile(file));
  } catch { response.writeHead(404).end('Not found'); }
});
if (server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const entryPath = process.env.RBUSH_DEMO_ROOT ? basePath : `${basePath}demo/`;
  demoUrl = `http://127.0.0.1:${server.address().port}${entryPath}`;
}
let browser;
const failures = [];
let checks = 0;
async function check(name, task) {
  await task(); checks++; console.log(`✓ ${name}`);
}
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1512, height: 1100 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => failures.push(error.message));
  await page.goto(demoUrl);
  await page.waitForFunction(() => window.RBushDemo?.snapshot().count === 10000);
  await check('Initial bulk-loaded dataset and exact query agreement', async () => {
    assert.equal(await page.locator('#count').innerText(), '10,000');
    assert.equal(await page.locator('#verification').getAttribute('data-valid'), 'true');
    assert.ok((await page.evaluate(() => window.RBushDemo.snapshot().results)) > 0);
  });
  await check('Every distribution, point geometry, and node capacity', async () => {
    await page.selectOption('#dataset-size', '1000'); await page.selectOption('#shape', 'points'); await page.fill('#capacity', '16');
    for (const distribution of ['uniform', 'clusters', 'grid']) {
      await page.selectOption('#distribution', distribution); await page.click('#generate');
      await page.waitForFunction(() => window.RBushDemo.snapshot().count === 1000 && !document.querySelector('#generate').disabled);
      assert.equal(await page.locator('#verification').getAttribute('data-valid'), 'true');
    }
    assert.match(await page.locator('#node-count').innerText(), /capacity 16/);
  });
  await check('Nearest neighbors, radius, predicate, and unbounded k', async () => {
    await page.click('[data-mode="nearest"]'); await page.fill('#min-x', '500'); await page.fill('#min-y', '350');
    await page.fill('#neighbors', '7'); await page.fill('#radius', '250'); await page.selectOption('#category', 'teal'); await page.click('#run-query');
    assert.equal(await page.locator('#result-count').innerText(), '7');
    assert.equal(await page.locator('#verification').getAttribute('data-valid'), 'true');
    assert.deepEqual([...new Set(await page.locator('.item-category').allTextContents())], ['teal']);
    await page.fill('#neighbors', '0'); await page.click('#run-query');
    assert.ok((await page.evaluate(() => window.RBushDemo.snapshot().results)) > 7);
    assert.equal(await page.locator('#verification').getAttribute('data-valid'), 'true');
    // A nearest center may exceed the previous window maxima. Switching modes
    // must restore a valid rectangle instead of treating that center as MinX/Y.
    for (const nextMode of ['query', 'move', 'insert']) {
      await page.click('[data-mode="nearest"]'); await page.fill('#min-x', '1500'); await page.fill('#min-y', '1200'); await page.click('#run-query');
      await page.click(`[data-mode="${nextMode}"]`);
      assert.ok(Number(await page.inputValue('#min-x')) <= Number(await page.inputValue('#max-x')));
      assert.ok(Number(await page.inputValue('#min-y')) <= Number(await page.inputValue('#max-y')));
      if (nextMode !== 'insert') { await page.click('#run-query'); assert.equal(await page.locator('#verification').getAttribute('data-valid'), 'true'); }
    }
    await page.click('[data-mode="query"]');
  });
  await check('Tree overlays at every exposed depth', async () => {
    await page.locator('label').filter({ has: page.locator('#show-tree') }).click();
    for (const depth of ['all', '0', '1', '2', '3']) await page.selectOption('#tree-level', depth);
    assert.equal(await page.locator('#show-tree').isChecked(), true);
  });
  await check('Pointer window selection and index/linear comparison', async () => {
    await page.selectOption('#category', 'all'); await page.click('[data-mode="query"]');
    const box = await page.locator('#canvas').boundingBox();
    await page.mouse.move(box.x + box.width * .25, box.y + box.height * .25); await page.mouse.down();
    await page.mouse.move(box.x + box.width * .7, box.y + box.height * .7, { steps: 8 }); await page.mouse.up();
    assert.ok((await page.evaluate(() => window.RBushDemo.snapshot().results)) > 0);
    assert.equal(await page.locator('#verification').getAttribute('data-valid'), 'true');
  });
  await check('Keyboard-accessible insert, inspect, focus, and delete', async () => {
    await page.click('[data-mode="insert"]'); await page.fill('#min-x', '505'); await page.fill('#min-y', '355'); await page.click('#run-query');
    assert.equal(await page.evaluate(() => window.RBushDemo.snapshot().count), 1001);
    assert.equal(await page.locator('#inspector').isVisible(), true);
    await page.click('#focus-item'); await page.click('#delete-item');
    assert.equal(await page.evaluate(() => window.RBushDemo.snapshot().count), 1000);
    assert.equal(await page.locator('#verification').getAttribute('data-valid'), 'true');
    const savedBounds = await page.evaluate(() => window.RBushDemo.snapshot().bounds);
    await page.fill('#min-x', '1500'); await page.fill('#min-y', '1200'); await page.click('#run-query');
    assert.equal(await page.evaluate(() => window.RBushDemo.snapshot().count), 1001);
    assert.deepEqual(await page.evaluate(() => window.RBushDemo.snapshot().bounds), savedBounds);
    assert.equal(await page.locator('#verification').getAttribute('data-valid'), 'true');
    assert.match(await page.locator('#api-code').innerText(), /tree.Insert\(item\)/);
    await page.click('#delete-item');
    assert.equal(await page.evaluate(() => window.RBushDemo.snapshot().count), 1000);
    assert.deepEqual(await page.evaluate(() => window.RBushDemo.snapshot().bounds), savedBounds);
    await page.click('[data-mode="query"]');
    assert.ok(Number(await page.inputValue('#min-x')) <= Number(await page.inputValue('#max-x')));
    assert.ok(Number(await page.inputValue('#min-y')) <= Number(await page.inputValue('#max-y')));
    await page.click('#run-query'); assert.equal(await page.locator('#verification').getAttribute('data-valid'), 'true');
    await page.click('#fit');
  });
  await check('Bulk-load versus insertion benchmark', async () => {
    await page.click('#benchmark'); await page.waitForFunction(() => !document.querySelector('#benchmark').disabled);
    assert.match(await page.locator('#benchmark-result').innerText(), /Counts and current window query agree/);
  });
  await check('Executable geometry, comparer, snapshot, and JavaScript API examples', async () => {
    await page.click('.recipes summary');
    for (const recipe of ['geometry', 'comparer', 'snapshot', 'aliases']) {
      await page.selectOption('#recipe', recipe); await page.click('#run-recipe');
      const output = JSON.parse(await page.locator('#recipe-output').innerText());
      if (recipe === 'geometry') { assert.equal(output.Area, 200); assert.equal(output.DistanceTo, 5); assert.equal(output.InfiniteContains, true); }
      if (recipe === 'comparer') { assert.equal(output.BeforeDelete, 2); assert.equal(output.Removed, true); assert.equal(output.AfterDelete, 0); }
      if (recipe === 'snapshot') { assert.equal(output.RestoredCount, 1000); assert.equal(output.QueryAgrees, true); }
      if (recipe === 'aliases') { assert.equal(output.IteratedCount, 1); assert.equal(output.Collides, true); assert.equal(output.Valid, true); assert.equal(output.CountAfterRemove, 0); }
    }
    await page.click('.recipes summary');
  });
  await check('Export/import round trip preserves every item', async () => {
    const downloadPromise = page.waitForEvent('download'); await page.click('#export'); const download = await downloadPromise;
    const data = await readFile(await download.path(), 'utf8'); const payload = JSON.parse(data);
    assert.equal(payload.items.length, 1000);
    await page.click('#clear'); assert.equal(await page.evaluate(() => window.RBushDemo.snapshot().count), 0);
    assert.equal(await page.locator('#canvas-empty').isVisible(), true);
    await page.setInputFiles('#import-file', { name: 'roundtrip.json', mimeType: 'application/json', buffer: Buffer.from(data) });
    await page.waitForFunction(() => window.RBushDemo.snapshot().count === 1000);
    await page.click('#search-all'); assert.equal(await page.locator('#result-count').innerText(), '1,000');
    assert.equal(await page.locator('#verification').getAttribute('data-valid'), 'true');
  });
  await check('Move updates item envelope and index atomically', async () => {
    // Use a deterministic fixture so the drag tests the actual indexed geometry.
    const fixture = { items: [{ id: 7, category: 'coral', Envelope: { MinX: 400, MinY: 300, MaxX: 500, MaxY: 400 } }] };
    await page.setInputFiles('#import-file', { name: 'move.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
    await page.waitForFunction(() => window.RBushDemo.snapshot().count === 1);
    await page.click('[data-mode="move"]');
    const box = await page.locator('#canvas').boundingBox(), view = await page.evaluate(() => window.RBushDemo.snapshot().view);
    const x = box.x + box.width / 2 + (450 - view.x) * view.scale, y = box.y + box.height / 2 + (350 - view.y) * view.scale;
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 45, y + 30, { steps: 10 }); await page.mouse.up();
    const details = JSON.parse(await page.locator('#item-details').innerText());
    assert.ok(details.Envelope.MinX > 400); assert.ok(details.Envelope.MinY > 300);
    assert.equal(await page.evaluate(() => window.RBushDemo.snapshot().count), 1);
    await page.click('#search-all'); assert.equal(await page.locator('#verification').getAttribute('data-valid'), 'true');
  });
  await check('Dark theme, responsive viewport, and persisted theme', async () => {
    await page.click('#theme'); assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.reload(); await page.waitForFunction(() => window.RBushDemo?.snapshot().count === 10000);
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.screenshot({ path: path.join(path.dirname(screenshot), 'demo-dark.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.click('[data-mode="nearest"]'); await page.click('#run-query');
    assert.equal(await page.locator('#verification').getAttribute('data-valid'), 'true');
    await page.screenshot({ path: path.join(path.dirname(screenshot), 'demo-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1512, height: 1100 }); await page.click('#theme');
  });
  await check('100,000-item bulk load and spatial query correctness', async () => {
    await page.selectOption('#dataset-size', '100000'); await page.click('#generate');
    await page.waitForFunction(() => window.RBushDemo.snapshot().count === 100000 && !document.querySelector('#generate').disabled);
    assert.equal(await page.locator('#verification').getAttribute('data-valid'), 'true');
    await page.click('[data-mode="query"]'); await page.click('#run-query');
    assert.equal(await page.locator('#verification').getAttribute('data-valid'), 'true');
  });
  await check('No browser runtime exceptions', async () => assert.deepEqual(failures, []));
  await page.selectOption('#dataset-size', '10000'); await page.click('#generate');
  await page.waitForFunction(() => window.RBushDemo.snapshot().count === 10000 && !document.querySelector('#generate').disabled);
  await page.screenshot({ path: screenshot, fullPage: true });
  console.log(`\n${checks} browser checks passed.`);
} finally {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
