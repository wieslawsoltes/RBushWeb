#!/usr/bin/env node
import assert from 'node:assert/strict';
import { cpus, platform, release, arch, totalmem } from 'node:os';
import { performance } from 'node:perf_hooks';
import { RBush, Envelope } from '../src/index.js';

const HELP = `Usage: node scripts/benchmark.mjs [options]

  --size N[,N...]  Item counts (default: 1000,10000,100000)
  --samples N     Timed samples per operation (default: 5)
  --warmup N      Untimed warmup samples per operation (default: 2)
  --queries N     Rectangle queries per batch (default: 100)
  --nearest N     Nearest-neighbor queries per batch (default: 12)
  --seed N        Unsigned 32-bit random seed (default: 1592594996)
  --json          Print machine-readable results instead of a table
  --help          Show this help

Every size runs uniform points, clustered points, uniform rectangles, and
clustered rectangles. No network, runtime dependencies, or generated files.
Use --size 1000 --samples 3 --warmup 1 for a quick smoke run.
`;

function parseOptions(args) {
  const options = {
    sizes: [1000, 10000, 100000], samples: 5, warmup: 2,
    queries: 100, nearest: 12, seed: 1592594996, json: false,
  };
  for (let index = 0; index < args.length; index++) {
    const option = args[index];
    if (option === '--help') {
      console.log(HELP);
      process.exit(0);
    }
    if (option === '--json') {
      options.json = true;
      continue;
    }
    if (!['--size', '--samples', '--warmup', '--queries', '--nearest', '--seed'].includes(option)) {
      throw new Error(`Unknown option: ${option}\n${HELP}`);
    }
    const raw = args[++index];
    if (raw === undefined || raw.startsWith('--')) throw new Error(`Missing value for ${option}`);
    const values = option === '--size' ? raw.split(',').map(Number) : [Number(raw)];
    const minimum = ['--warmup', '--seed'].includes(option) ? 0 : 1;
    if (values.some(value => !Number.isSafeInteger(value) || value < minimum)) {
      throw new Error(`${option} requires ${minimum === 0 ? 'nonnegative' : 'positive'} integers`);
    }
    if (option === '--size') options.sizes = [...new Set(values)];
    else options[option.slice(2)] = values[0];
  }
  if (options.seed > 0xffffffff) throw new Error('--seed must fit an unsigned 32-bit integer');
  return options;
}

function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const clusterCenters = [[0.2, 0.2], [0.8, 0.2], [0.5, 0.5], [0.2, 0.8], [0.8, 0.8]];

function makeData(size, clustered, rectangles, seed) {
  const random = randomGenerator(seed);
  const items = new Array(size);
  for (let id = 0; id < size; id++) {
    const center = clusterCenters[id % clusterCenters.length];
    const x = clustered ? center[0] + (random() + random() + random() - 1.5) * 0.08 : random();
    const y = clustered ? center[1] + (random() + random() + random() - 1.5) * 0.08 : random();
    const width = rectangles ? 0.0001 + random() * 0.008 : 0;
    const height = rectangles ? 0.0001 + random() * 0.008 : 0;
    items[id] = { id, Envelope: new Envelope(x, y, x + width, y + height) };
  }
  return items;
}

function makeQueries(count, items, seed) {
  const random = randomGenerator(seed);
  return Array.from({ length: count }, (_, index) => {
    // Alternate queries anchored on data with queries anywhere in the world.
    const item = items[Math.floor(random() * items.length)].Envelope;
    const x = index % 2 === 0 ? item.MinX : random();
    const y = index % 2 === 0 ? item.MinY : random();
    const halfWidth = [0.0025, 0.0125, 0.05][index % 3];
    return new Envelope(x - halfWidth, y - halfWidth, x + halfWidth, y + halfWidth);
  });
}

// These oracles deliberately do not call library geometry methods.
function intersects(a, b) {
  return a.MinX <= b.MaxX && a.MinY <= b.MaxY && a.MaxX >= b.MinX && a.MaxY >= b.MinY;
}

function distance(envelope, x, y) {
  const dx = Math.max(envelope.MinX - x, 0, x - envelope.MaxX);
  const dy = Math.max(envelope.MinY - y, 0, y - envelope.MaxY);
  return Math.sqrt(dx * dx + dy * dy);
}

function linearSearch(items, query) {
  const result = [];
  for (let index = 0; index < items.length; index++) {
    if (intersects(items[index].Envelope, query)) result.push(items[index]);
  }
  return result;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function measure(options, prepare, run, verify = () => {}) {
  const timings = [];
  let checksum = 0;
  for (let sample = -options.warmup; sample < options.samples; sample++) {
    const input = prepare();
    const start = performance.now();
    const result = run(input);
    const elapsed = performance.now() - start;
    // Verification and setup never contribute to reported elapsed time.
    verify(input, result);
    checksum += typeof result === 'number' ? result : 0;
    if (sample >= 0) timings.push(elapsed);
  }
  return { medianMs: median(timings), minMs: Math.min(...timings), maxMs: Math.max(...timings), samplesMs: timings, checksum };
}

function verifySearch(tree, items, queries) {
  let resultCount = 0;
  for (const query of queries) {
    const expected = linearSearch(items, query).map(item => item.id).sort((a, b) => a - b);
    const actual = tree.Search(query).map(item => item.id).sort((a, b) => a - b);
    assert.deepEqual(actual, expected, 'Spatial search differs from independent linear scan');
    resultCount += expected.length;
  }
  return resultCount;
}

function verifyNearest(tree, items, queries) {
  for (const query of queries) {
    const expected = items
      .filter(item => !query.predicate || query.predicate(item))
      .map(item => distance(item.Envelope, query.x, query.y))
      .filter(value => query.maxDistance === undefined || value <= query.maxDistance)
      .sort((a, b) => a - b)
      .slice(0, query.k);
    const actual = tree.Knn(query.k, query.x, query.y, query.maxDistance, query.predicate);
    assert.equal(actual.length, expected.length, 'Nearest result count differs from independent sort');
    assert.equal(new Set(actual).size, actual.length, 'Nearest query returned duplicate objects');
    for (let index = 0; index < actual.length; index++) {
      const item = actual[index];
      assert.equal(items[item.id], item, 'Nearest query returned an object outside the dataset');
      assert.ok(!query.predicate || query.predicate(item), 'Nearest query ignored its predicate');
      const actualDistance = distance(item.Envelope, query.x, query.y);
      assert.ok(Math.abs(actualDistance - expected[index]) <= 1e-12,
        `Nearest distance at index ${index}: expected ${expected[index]}, got ${actualDistance}`);
    }
    // Equal-distance ordering is intentionally not a performance-test invariant.
    // The upstream compatibility tests cover the API's tie-order behavior.
  }
}

function runCase(options, size, clustered, rectangles) {
  const dataset = `${clustered ? 'clustered' : 'uniform'}-${rectangles ? 'rectangles' : 'points'}`;
  const seed = (options.seed + (clustered ? 101 : 0) + (rectangles ? 1009 : 0)) >>> 0;
  const items = makeData(size, clustered, rectangles, seed);
  const queries = makeQueries(options.queries, items, seed ^ 0x85ebca6b);
  const nearestQueries = makeQueries(options.nearest, items, seed ^ 0xc2b2ae35).map((query, index) => ({
    k: 10, x: (query.MinX + query.MaxX) / 2, y: (query.MinY + query.MaxY) / 2,
    maxDistance: index % 3 === 1 ? 0.1 : undefined,
    predicate: index % 3 === 2 ? item => item.id % 2 === 0 : undefined,
  }));
  const bulkTree = new RBush();
  bulkTree.BulkLoad(items);
  const insertedTree = new RBush();
  for (const item of items) insertedTree.Insert(item);
  assert.equal(bulkTree.Count, size);
  assert.equal(insertedTree.Count, size);
  const queryResultCount = verifySearch(bulkTree, items, queries);
  assert.equal(verifySearch(insertedTree, items, queries), queryResultCount);
  verifyNearest(bulkTree, items, nearestQueries);

  const bulk = measure(options, () => new RBush(), tree => { tree.BulkLoad(items); return tree.Count; },
    tree => assert.equal(tree.Count, size));
  const insert = measure(options, () => new RBush(), tree => {
    for (const item of items) tree.Insert(item);
    return tree.Count;
  }, tree => assert.equal(tree.Count, size));
  const search = measure(options, () => bulkTree, tree => {
    let found = 0;
    for (const query of queries) found += tree.Search(query).length;
    return found;
  }, (_, found) => assert.equal(found, queryResultCount));
  const linear = measure(options, () => items, data => {
    let found = 0;
    for (const query of queries) found += linearSearch(data, query).length;
    return found;
  }, (_, found) => assert.equal(found, queryResultCount));
  const nearest = measure(options, () => bulkTree, tree => {
    let found = 0;
    for (const query of nearestQueries) found += tree.Knn(query.k, query.x, query.y, query.maxDistance, query.predicate).length;
    return found;
  });
  const deleteCount = Math.min(1000, Math.max(1, Math.floor(size / 10)));
  const stride = Math.floor(size / deleteCount);
  const deletedItems = Array.from({ length: deleteCount }, (_, index) => items[index * stride]);
  const deletedIds = new Set(deletedItems.map(item => item.id));
  const deletion = measure(options, () => {
    const tree = new RBush();
    tree.BulkLoad(items);
    return tree;
  }, tree => {
    let removed = 0;
    for (const item of deletedItems) if (tree.Delete(item)) removed++;
    return removed;
  }, (tree, removed) => {
    assert.equal(removed, deleteCount);
    assert.equal(tree.Count, size - deleteCount);
    const remaining = tree.Search();
    assert.equal(remaining.length, size - deleteCount);
    assert.equal(new Set(remaining).size, remaining.length);
    assert.ok(remaining.every(item => items[item.id] === item && !deletedIds.has(item.id)));
    assert.equal(tree.Delete(deletedItems[0]), false);
  });
  return { dataset, items: size, queryResultCount, averageQueryHits: queryResultCount / queries.length,
    searchQueries: queries.length, nearestQueries: nearestQueries.length, deleteCount,
    bulk, insert, search, linear, nearest, deletion };
}

const options = parseOptions(process.argv.slice(2));
const processors = cpus();
const environment = {
  node: process.version, v8: process.versions.v8,
  platform: `${platform()} ${release()} ${arch()}`,
  cpu: processors[0]?.model ?? 'unknown', logicalCpus: processors.length,
  totalMemoryGiB: Math.round(totalmem() / 1024 ** 3 * 10) / 10,
  timestamp: new Date().toISOString(), nodeFlags: process.execArgv,
};
if (!options.json) {
  console.log('RBushWeb reproducible benchmark — medians in milliseconds');
  console.log(JSON.stringify({ environment, options }, null, 2));
  console.log('Search/linear/nearest/delete columns measure complete batches, not individual operations.');
}
const results = [];
for (const size of options.sizes) {
  for (const clustered of [false, true]) {
    for (const rectangles of [false, true]) {
      const result = runCase(options, size, clustered, rectangles);
      results.push(result);
      if (!options.json) console.log(`Verified ${result.dataset}, ${size.toLocaleString('en-US')} items`);
    }
  }
}
if (options.json) console.log(JSON.stringify({ environment, options, results }, null, 2));
else {
  console.table(results.map(result => ({
    dataset: result.dataset, items: result.items,
    'bulk ms': result.bulk.medianMs.toFixed(3),
    'insert ms': result.insert.medianMs.toFixed(3),
    'search ms': result.search.medianMs.toFixed(3),
    'linear ms': result.linear.medianMs.toFixed(3),
    'scan/search': (result.linear.medianMs / result.search.medianMs).toFixed(2),
    'nearest ms': result.nearest.medianMs.toFixed(3),
    'delete ms': result.deletion.medianMs.toFixed(3),
    deleted: result.deleteCount, 'hits/query': result.averageQueryHits.toFixed(1),
  })));
  console.log('All result checks passed. Use --json to inspect every sample and its min/max range.');
  console.log('Results depend on hardware, runtime, load, distribution, and query selectivity; see docs/performance.md.');
}
