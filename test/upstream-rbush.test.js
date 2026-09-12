// Ports every [Test] in upstream RBush.Test/RBushTests.cs without dropping assertions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RBush, Envelope } from '../src/index.js';
import { treeData, missingEnvelopeData } from './fixtures.js';
import { Point, getPoints, enclosing, equalPointSets, assertEnvelope } from './helpers.js';
const points = Point.CreatePoints(treeData);
const missing = Point.CreatePoints(missingEnvelopeData);

test('RBushTests.RootLeafSplitWorks', () => {
  const data = getPoints(12), tree = new RBush();
  for (let i = 0; i < 9; i++) tree.Insert(data[i]);
  assert.equal(tree.Root.Height, 1); assert.equal(tree.Root.Children.length, 9); assert.equal(tree.Root.IsLeaf, true);
  assertEnvelope(tree.Root.Envelope, new Envelope(0, 0, 8, 8));
  tree.Insert(data[9]);
  assert.equal(tree.Root.Height, 2); assert.equal(tree.Root.Children.length, 2); assert.equal(tree.Root.IsLeaf, false);
  assertEnvelope(tree.Root.Envelope, new Envelope(0, 0, 9, 9));
});
test('RBushTests.InsertTestData', () => {
  const tree = new RBush(); points.forEach(p => tree.Insert(p));
  assert.equal(tree.Count, points.length); equalPointSets(points, tree.Search()); assertEnvelope(tree.Envelope, enclosing(points));
});
test('RBushTests.BulkLoadTestData', () => {
  const tree = new RBush(); tree.BulkLoad(points);
  assert.equal(tree.Count, points.length); equalPointSets(points, tree.Search());
});
test('RBushTests.BulkLoadSplitsTreeProperly', () => {
  const tree = new RBush(4); tree.BulkLoad(points); tree.BulkLoad(points);
  assert.equal(tree.Count, points.length * 2); assert.equal(tree.Root.Height, 4);
});
test('RBushTests.BulkLoadMergesTreesProperly', () => {
  const smaller = getPoints(10), tree1 = new RBush(4), tree2 = new RBush(4);
  tree1.BulkLoad(smaller); tree1.BulkLoad(points); tree2.BulkLoad(points); tree2.BulkLoad(smaller);
  assert.equal(tree1.Count, tree2.Count); assert.equal(tree1.Root.Height, tree2.Root.Height);
  equalPointSets([...points, ...smaller], tree1.Search()); equalPointSets([...points, ...smaller], tree2.Search());
});
test('RBushTests.SearchReturnsEmptyResultIfNothingFound', () => {
  const tree = new RBush(4); tree.BulkLoad(points);
  assert.deepEqual(tree.Search(new Envelope(200, 200, 210, 210)), []);
});
test('RBushTests.SearchReturnsMatchingResults', () => {
  const tree = new RBush(4); tree.BulkLoad(points);
  const envelope = new Envelope(40, 20, 80, 70);
  equalPointSets(points.filter(p => p.Envelope.Intersects(envelope)), tree.Search(envelope));
});
test('RBushTests.BasicRemoveTest', () => {
  const tree = new RBush(4); tree.BulkLoad(points);
  for (const i of [0, 1, 2, points.length - 1, points.length - 2, points.length - 3]) tree.Delete(points[i]);
  const expected = points.slice(3, points.length - 3);
  equalPointSets(expected, tree.Search()); assertEnvelope(tree.Envelope, enclosing(expected));
});
test('RBushTests.NonExistentItemCanBeDeleted', () => {
  const tree = new RBush(4); tree.BulkLoad(points); tree.Delete(new Point(13, 13, 13, 13)); assert.equal(tree.Count, points.length);
});
test('RBushTests.DeleteTreeIsEmptyShouldNotThrow', () => {
  const tree = new RBush(); tree.Delete(new Point(1, 1, 1, 1)); assert.equal(tree.Count, 0);
});
test('RBushTests.DeleteDeletingLastPointShouldNotThrow', () => {
  const tree = new RBush(), p = new Point(1, 1, 1, 1); tree.Insert(p); tree.Delete(p); assert.equal(tree.Count, 0);
});
test('RBushTests.ClearWorks', () => {
  const tree = new RBush(4); tree.BulkLoad(points); tree.Clear(); assert.equal(tree.Count, 0); assert.equal(tree.Root.Children.length, 0);
});
test('RBushTests.TestSearchAfterInsert', () => {
  const maxEntries = 9, tree = new RBush(maxEntries), first = points.slice(0, maxEntries);
  first.forEach(p => tree.Insert(p)); equalPointSets(first, tree.Search(enclosing(first)));
});
for (const [name, bulk] of [['TestSearchAfterInsertWithSplitRoot', false], ['TestSearchAfterBulkLoadWithSplitRoot', true]]) {
  test(`RBushTests.${name}`, () => {
    const maxEntries = 4, tree = new RBush(maxEntries), first = points.slice(0, maxEntries * maxEntries + 2), extra = points.slice(-5);
    if (bulk) { tree.BulkLoad(first); tree.BulkLoad(extra); }
    else { first.forEach(p => tree.Insert(p)); extra.forEach(p => tree.Insert(p)); }
    equalPointSets(extra, tree.Search(enclosing(extra)));
  });
}
test('RBushTests.AdditionalRemoveTest', () => {
  const tree = new RBush(), numDelete = 18;
  points.forEach(p => tree.Insert(p)); points.slice(0, numDelete).forEach(p => tree.Delete(p));
  assert.equal(tree.Count, points.length - numDelete); equalPointSets(points.slice(numDelete), tree.Search());
});
for (const [name, bulk, count] of [
  ['BulkLoadAfterDeleteTest1', true, 18], ['BulkLoadAfterDeleteTest2', true, 4],
  ['InsertAfterDeleteTest1', false, 18], ['InsertAfterDeleteTest2', false, 4],
]) {
  test(`RBushTests.${name}`, () => {
    const pts = getPoints(20), removed = pts.slice(0, count), tree = new RBush(4);
    if (bulk) tree.BulkLoad(pts); else pts.forEach(p => tree.Insert(p));
    removed.forEach(p => tree.Delete(p));
    if (bulk) tree.BulkLoad(removed); else removed.forEach(p => tree.Insert(p));
    assert.equal(tree.Search().length, pts.length); equalPointSets(pts, tree.Search());
  });
}
for (const [name, bulk] of [['MissingEnvelopeTestInsertIndividually', false], ['TestBulk', true]]) {
  test(`RBushTests.${name}`, () => {
    const tree = new RBush();
    if (bulk) tree.BulkLoad(missing); else missing.forEach(p => tree.Insert(p));
    const envelope = new Envelope(34.73274678, 31.87729923, 34.73274678, 31.87729923);
    assert.equal(tree.Search(envelope).length, tree.Search().filter(p => p.Envelope.Intersects(envelope)).length);
  });
}
