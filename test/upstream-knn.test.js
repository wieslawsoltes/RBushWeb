// Ports all six upstream KnnTests.cs [Test] methods and exact numeric fixtures.
import { test } from 'node:test';
import { RBush } from '../src/index.js';
import { knnData, richData } from './fixtures.js';
import { Point, equalPointSequences } from './helpers.js';
const points = Point.CreatePoints(knnData), rich = Point.CreatePoints(richData);
const nearest = (data, x, y) => data.slice().sort((a, b) => a.DistanceTo(x, y) - b.DistanceTo(x, y));

test('KnnTests.FindsNNeighbors', () => {
  const tree = new RBush(); tree.BulkLoad(points);
  equalPointSequences(nearest(points, 40, 40).slice(0, 10), tree.Knn(10, 40, 40));
});
test('KnnTests.DoesNotThrowIfRequestingTooManyItems', () => {
  const tree = new RBush(); tree.BulkLoad(points); tree.Knn(1000, 40, 40);
});
test('KnnTests.FindAllNeighborsForMaxDistance', () => {
  const tree = new RBush(); tree.BulkLoad(points);
  equalPointSequences(nearest(points.filter(p => p.DistanceTo(40, 40) <= 10), 40, 40), tree.Knn(0, 40, 40, 10));
});
test('KnnTests.FindNNeighborsForMaxDistance', () => {
  const tree = new RBush(); tree.BulkLoad(points);
  equalPointSequences(nearest(points, 40, 40).slice(0, 1), tree.Knn(1, 40, 40, 10));
});
test('KnnTests.DoesNotThrowIfRequestingTooManyItemsForMaxDistance', () => {
  const tree = new RBush(); tree.BulkLoad(points); tree.Knn(1000, 40, 40, 10);
});
test('KnnTests.FindNeighborsThatSatisfyAGivenPredicate', () => {
  const tree = new RBush(); tree.BulkLoad(rich);
  equalPointSequences(nearest(rich.filter(p => p.Envelope.MinX !== 2), 2, 4).slice(0, 1), tree.Knn(1, 2, 4, null, p => p.Envelope.MinX !== 2));
});
