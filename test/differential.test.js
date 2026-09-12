import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RBush, Envelope, Knn, DistanceTo, RBushExtensions } from '../src/index.js';
import { Point, assertEnvelope, intersects, distance, rng, assertTree } from './helpers.js';

function item(id, random) {
  const x = Math.floor(random() * 2000) - 1000, y = Math.floor(random() * 2000) - 1000;
  return { id, Envelope: new Envelope(x, y, x + Math.floor(random() * 50), y + Math.floor(random() * 50)) };
}
const ids = values => values.map(p => p.id).sort((a,b) => a-b);

for (const maxEntries of [4, 5, 9, 16, 32]) {
  test(`Differential mixed insert/bulk/delete/clear vs brute force; maxEntries=${maxEntries}`, () => {
    const random = rng(0xB005 + maxEntries), tree = new RBush(maxEntries);
    let expected = [], id = 0;
    for (let step = 0; step < 500; step++) {
      const operation = random();
      if (operation < 0.40) {
        const p = item(id++, random); expected.push(p); tree.Insert(p);
      } else if (operation < 0.65) {
        const batch = Array.from({ length: 1 + Math.floor(random() * 35) }, () => item(id++, random));
        tree.BulkLoad(batch); expected.push(...batch);
      } else if (operation < 0.88 && expected.length) {
        const p = expected[Math.floor(random() * expected.length)];
        assert.equal(tree.Delete(p), true); expected = expected.filter(q => q !== p);
        assert.equal(tree.Delete(p), false, 'second delete reports absence');
      } else if (operation < 0.90) {
        tree.Clear(); expected = [];
      } else {
        assert.equal(tree.Delete(item(-1, random)), false);
      }
      assertTree(tree, expected, maxEntries);
      const x = Math.floor(random() * 2500) - 1250, y = Math.floor(random() * 2500) - 1250;
      const query = new Envelope(x, y, x + random() * 500, y + random() * 500);
      assert.deepEqual(ids(tree.Search(query)), ids(expected.filter(p => intersects(p.Envelope, query))));
      if (step % 10 === 0) {
        const k = Math.floor(random() * 20), limit = step % 20 === 0 ? null : random() * 1500;
        const predicate = p => p.id % 3 !== 0;
        let nearest = tree.Search().filter(predicate).filter(p => limit === null || distance(p.Envelope, x, y) <= limit)
          .sort((a,b) => distance(a.Envelope, x, y) - distance(b.Envelope, x, y));
        if (k > 0) nearest = nearest.slice(0, k);
        assert.deepEqual(tree.Knn(k, x, y, limit, predicate), nearest);
      }
    }
  });
}

for (const strategy of ['bulk', 'insert']) {
  test(`Every original item is found at every corner after ${strategy}; overlapping and degenerate geometry`, () => {
    const random = rng(420), data = Array.from({ length: 400 }, (_, id) => item(id, random));
    const tree = new RBush(4);
    if (strategy === 'bulk') tree.BulkLoad(data); else data.forEach(p => tree.Insert(p));
    for (const p of data) {
      for (const [x,y] of [[p.Envelope.MinX,p.Envelope.MinY], [p.Envelope.MaxX,p.Envelope.MaxY]]) {
        const query = new Envelope(x,y,x,y);
        assert.deepEqual(ids(tree.Search(query)), ids(data.filter(q => intersects(q.Envelope, query))));
      }
    }
    assertTree(tree, data, 4);
  });
}

test('KNN preserves Search traversal order for equal distances across internal nodes', () => {
  const data = Array.from({ length: 160 }, (_, id) => {
    const [x,y] = [[-10,0], [10,0], [0,-10], [0,10]][id % 4];
    return { id, Envelope: new Envelope(x,y,x,y) };
  });
  const tree = new RBush(4); tree.BulkLoad(data);
  for (const limit of [null, 10, 9.999, 11]) {
    const expected = tree.Search().filter(p => limit === null || distance(p.Envelope,0,0) <= limit);
    for (const k of [-1, 0, 1, 7, 159, 1000]) {
      assert.deepEqual(tree.Knn(k,0,0,limit), k > 0 ? expected.slice(0,k) : expected);
    }
  }
});

test('KNN distance is to rectangle boundary and includes interior, edge, corner, and exact radius', () => {
  const data = [new Point(-1,-1,1,1), new Point(3,4,4,5), new Point(0,5,2,7), new Point(4,4,5,5), new Point(0,0,0,0)];
  const tree = new RBush(4); tree.BulkLoad(data);
  for (const radius of [0, 5, Math.sqrt(32), null]) {
    const expected = tree.Search().filter(p => radius === null || distance(p.Envelope,0,0) <= radius)
      .sort((a,b) => distance(a.Envelope,0,0) - distance(b.Envelope,0,0));
    assert.deepEqual(tree.Knn(0,0,0,radius), expected);
  }
});

test('KNN predicate runs before k truncation, rejects all, and supports empty trees', () => {
  const tree = new RBush(4), data = Array.from({ length: 80 }, (_, id) => ({ id, Envelope: new Envelope(id,0,id,0) }));
  assert.deepEqual(tree.Knn(5,0,0), []);
  tree.BulkLoad(data);
  assert.deepEqual(tree.Knn(4,0,0,null,p => p.id >= 30), data.slice(30,34));
  assert.deepEqual(tree.Knn(4,0,0,31,p => p.id >= 30), data.slice(30,32));
  assert.deepEqual(tree.Knn(4,0,0,null,() => false), []);
});

test('KNN extension works with a custom ISpatialIndex implementation', () => {
  const data = [new Point(3,4,3,4), new Point(0,0,0,0), new Point(10,0,10,0)];
  const index = { Search(envelope) { return envelope ? data.filter(p => intersects(p.Envelope,envelope)) : [...data]; } };
  assert.deepEqual(Knn(index,2,0,0), [data[1],data[0]]);
  assert.deepEqual(RBushExtensions.Knn(index,0,0,0,5), [data[1],data[0]]);
  assert.equal(DistanceTo(data[0].Envelope,0,0), 5);
  assert.equal(RBushExtensions.DistanceTo(data[0].Envelope,0,0), 5);
});

test('Delete removes all equal duplicates across leaves and maintains exact count', () => {
  const tree = new RBush(4), duplicate = new Point(1,1,1,1);
  const data = Array.from({ length: 100 }, () => new Point(1,1,1,1));
  tree.BulkLoad(data); assert.equal(tree.Count, 100);
  assert.equal(tree.Delete(duplicate), true); assert.equal(tree.Count, 0); assert.deepEqual(tree.Search(), []);
  assert.equal(tree.Delete(duplicate), false);
  tree.Insert(duplicate); assert.equal(tree.Count, 1); assert.deepEqual(tree.Search(), [duplicate]);
});

test('Default equality is object identity when Equals is absent', () => {
  const a = { Envelope: new Envelope(1,1,1,1) }, b = { Envelope: new Envelope(1,1,1,1) }, tree = new RBush();
  tree.BulkLoad([a,b,a]);
  assert.equal(tree.Delete({ Envelope: a.Envelope }), false);
  assert.equal(tree.Delete(a), true); assert.equal(tree.Count, 1); assert.deepEqual(tree.Search(), [b]);
});

for (const comparerKind of ['function', 'Equals', 'equals']) {
  test(`Custom equality comparer (${comparerKind}) deletes all matching values`, () => {
    const equals = (a,b) => a.id === b.id;
    const comparer = comparerKind === 'function' ? equals : { [comparerKind]: equals };
    const tree = new RBush(4, comparer), data = Array.from({ length: 80 }, (_, i) => ({ id: i % 5, Envelope: new Envelope(0,0,1,1) }));
    tree.BulkLoad(data);
    assert.equal(tree.Delete({ id: 2, Envelope: new Envelope(0,0,1,1) }), true);
    assert.equal(tree.Count, 64); assert.ok(tree.Search().every(p => p.id !== 2));
  });
}

test('BulkLoad consumes iterable once and preserves caller array order', () => {
  const data = Array.from({ length: 100 }, (_,i) => ({ id:i, Envelope:new Envelope(100-i,i,100-i,i) }));
  const snapshot = [...data], tree = new RBush(4);
  tree.BulkLoad(data); assert.deepEqual(data,snapshot);
  let passes = 0;
  function* once() { passes++; yield* data; }
  tree.BulkLoad(once()); assert.equal(passes,1); assert.equal(tree.Count,200);
  tree.BulkLoad([]); assert.equal(tree.Count,200);
});

test('Indexed item can be moved by delete, mutate, insert', () => {
  const tree = new RBush(4), p = { Envelope:new Envelope(1,1,2,2) };
  tree.Insert(p); assert.equal(tree.Delete(p),true);
  p.Envelope = new Envelope(100,100,102,102); tree.Insert(p);
  assert.deepEqual(tree.Search(new Envelope(0,0,10,10)),[]);
  assert.deepEqual(tree.Search(new Envelope(99,99,103,103)),[p]); assert.equal(tree.Count,1);
});

test('Search returns independent result arrays', () => {
  const tree = new RBush(), p = new Point(1,1,1,1); tree.Insert(p);
  const result = tree.Search(); result.length = 0;
  assert.equal(tree.Count,1); assert.deepEqual(tree.Search(),[p]);
});

test('Envelope pure geometry, inclusive bounds, value equality, and sentinels', () => {
  const a = new Envelope(1,2,5,8), b = new Envelope(3,4,7,10);
  assert.equal(a.Area,24); assert.equal(a.Margin,10);
  assertEnvelope(a.Extend(b),new Envelope(1,2,7,10));
  assertEnvelope(a.Intersection(b),new Envelope(3,4,5,8));
  assertEnvelope(a,new Envelope(1,2,5,8));
  assert.equal(a.Contains(new Envelope(1,2,5,8)),true);
  assert.equal(a.Contains(b),false); assert.equal(a.Intersects(b),true);
  assert.equal(a.Intersects(new Envelope(5,8,6,9)),true);
  assert.equal(a.Intersects(new Envelope(5.001,8.001,6,9)),false);
  assert.equal(a.Equals(new Envelope(1,2,5,8)),true);
  assert.equal(a.Equals(b),false); assert.equal(a.Equals(null),false);
  assert.equal(a.GetHashCode(),new Envelope(1,2,5,8).GetHashCode());
  assert.equal(Envelope.EmptyBounds.Area,0); assert.equal(Envelope.EmptyBounds.Margin,0);
  assert.equal(Envelope.InfiniteBounds.Contains(a),true);
  assert.equal(Envelope.EmptyBounds.Intersects(a),false);
  assertEnvelope(Envelope.EmptyBounds.Extend(a),a);
  assert.equal(a.Intersection(new Envelope(20,20,30,30)).Area,0);
  assert.equal(new Envelope(5,5,1,1).Area,0);
});

test('Envelope distance matches independent Euclidean clamping across quadrants and degeneracies', () => {
  const envelopes = [new Envelope(1,2,5,8),new Envelope(0,0,0,0),new Envelope(-2,-3,-2,7)];
  for (const e of envelopes) {
    for (let x = -10; x <= 10; x++) for (let y = -10; y <= 10; y++) {
      assert.equal(e.DistanceTo(x,y),distance(e,x,y));
    }
  }
});

test('Constructor clamps widths below four exactly as upstream', () => {
  for (const maxEntries of [-10,0,1,3]) {
    const tree = new RBush(maxEntries), data = Array.from({ length: 40 }, (_,id) => ({ id, Envelope:new Envelope(id,id,id,id) }));
    data.forEach(p => tree.Insert(p)); assertTree(tree,data,4);
  }
});
