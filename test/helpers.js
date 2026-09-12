import assert from 'node:assert/strict';
import { Envelope } from '../src/index.js';

// Faithful port of upstream Point.cs, including IEquatable<Point> semantics.
export class Point {
  constructor(minX, minY, maxX, maxY) {
    this.Envelope = new Envelope(minX, minY, maxX, maxY);
  }
  Equals(other) { return other instanceof Point && this.Envelope.Equals(other.Envelope); }
  GetHashCode() { return this.Envelope.GetHashCode(); }
  DistanceTo(x, y) { return this.Envelope.DistanceTo(x, y); }
  static CreatePoints(data) { return data.map(row => new Point(...row)); }
}
export const getPoints = count => Array.from({ length: count }, (_, i) => new Point(i, i, i, i));
export const enclosing = points => points.reduce((e, p) => e.Extend(p.Envelope), Envelope.EmptyBounds);
export const key = point => JSON.stringify([point.Envelope.MinX, point.Envelope.MinY, point.Envelope.MaxX, point.Envelope.MaxY]);
export function equalPointSets(expected, actual) {
  assert.deepEqual(new Set(actual.map(key)), new Set(expected.map(key)));
}
export function equalPointSequences(expected, actual) { assert.deepEqual(actual.map(key), expected.map(key)); }
export function assertEnvelope(actual, expected) {
  assert.deepEqual([actual.MinX, actual.MinY, actual.MaxX, actual.MaxY], [expected.MinX, expected.MinY, expected.MaxX, expected.MaxY]);
}
// Independent scalar geometry; do not call the production Envelope implementation.
export function intersects(a, b) {
  return a.MinX <= b.MaxX && a.MinY <= b.MaxY && a.MaxX >= b.MinX && a.MaxY >= b.MinY;
}
export function distance(e, x, y) {
  const dx = Math.max(e.MinX - x, x - e.MaxX, 0);
  const dy = Math.max(e.MinY - y, y - e.MaxY, 0);
  return Math.sqrt(dx * dx + dy * dy);
}
export function rng(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
export function assertTree(tree, expected, maxEntries) {
  const flattened = [];
  function visit(node) {
    assert.ok(Number.isInteger(node.Height) && node.Height >= 1, 'positive integer node height');
    assert.equal(node.IsLeaf, node.Height === 1);
    assert.ok(node.Children.length <= Math.max(4, maxEntries), 'maximum node occupancy');
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const child of node.Children) {
      if (node.IsLeaf) flattened.push(child);
      else { assert.equal(child.Height, node.Height - 1, 'balanced leaf depth'); visit(child); }
      const e = child.Envelope;
      minX = Math.min(minX, e.MinX); minY = Math.min(minY, e.MinY);
      maxX = Math.max(maxX, e.MaxX); maxY = Math.max(maxY, e.MaxY);
    }
    assertEnvelope(node.Envelope, { MinX: minX, MinY: minY, MaxX: maxX, MaxY: maxY });
  }
  visit(tree.Root);
  assert.equal(tree.Count, expected.length);
  assert.equal(flattened.length, expected.length);
  assert.deepEqual(flattened.map(p => p.id).sort((a,b) => a-b), expected.map(p => p.id).sort((a,b) => a-b));
  assert.deepEqual(tree.Search(), flattened, 'unbounded search visits descendants in traversal order');
  assertEnvelope(tree.Envelope, tree.Root.Envelope);
}
