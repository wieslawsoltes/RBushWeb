/*
 * RBushWeb — JavaScript port of viceroypenguin/RBush.
 * Copyright (c) 2026 RBushWeb contributors. MIT licensed; see LICENSE.
 * The R-tree packing/splitting algorithms retain the upstream behavior.
 */

const minX = b => b.MinX === undefined ? b.minX : b.MinX;
const minY = b => b.MinY === undefined ? b.minY : b.MinY;
const maxX = b => b.MaxX === undefined ? b.maxX : b.MaxX;
const maxY = b => b.MaxY === undefined ? b.maxY : b.MaxY;
const area = b => Math.max(maxX(b) - minX(b), 0) * Math.max(maxY(b) - minY(b), 0);
const margin = b => Math.max(maxX(b) - minX(b), 0) + Math.max(maxY(b) - minY(b), 0);
const intersects = (a, b) => minX(a) <= maxX(b) && minY(a) <= maxY(b) && maxX(a) >= minX(b) && maxY(a) >= minY(b);
const contains = (a, b) => minX(a) <= minX(b) && minY(a) <= minY(b) && maxX(a) >= maxX(b) && maxY(a) >= maxY(b);
const numeric = n => typeof n === 'number' && !Number.isNaN(n);
const inverted = b => minX(b) > maxX(b) || minY(b) > maxY(b);

function boxOf(item) {
  if (item == null) throw new TypeError('A spatial item or envelope is required.');
  return item.Envelope ?? item.envelope ?? item;
}

function checkBox(box) {
  if (box == null || !numeric(minX(box)) || !numeric(minY(box)) || !numeric(maxX(box)) || !numeric(maxY(box))) {
    throw new TypeError('An envelope requires four numeric coordinates (NaN is not indexable).');
  }
  return box;
}

function extend(a, b) {
  return new Envelope(Math.min(minX(a), minX(b)), Math.min(minY(a), minY(b)), Math.max(maxX(a), maxX(b)), Math.max(maxY(a), maxY(b)));
}

function extendedArea(a, b) {
  return Math.max(Math.max(maxX(a), maxX(b)) - Math.min(minX(a), minX(b)), 0)
    * Math.max(Math.max(maxY(a), maxY(b)) - Math.min(minY(a), minY(b)), 0);
}

/** Immutable bounding envelope, including empty and infinite bounds. */
export class Envelope {
  constructor(MinX = 0, MinY = 0, MaxX = 0, MaxY = 0) {
    if (arguments.length === 1 && typeof MinX === 'object' && MinX !== null) {
      const b = boxOf(MinX);
      MinX = minX(b); MinY = minY(b); MaxX = maxX(b); MaxY = maxY(b);
    }
    if ([MinX, MinY, MaxX, MaxY].some(value => typeof value !== 'number')) throw new TypeError('Envelope coordinates must be numbers.');
    this.MinX = MinX; this.MinY = MinY; this.MaxX = MaxX; this.MaxY = MaxY;
    Object.freeze(this);
  }

  get Area() { return area(this); }
  get Margin() { return margin(this); }
  Extend(other) { return extend(this, boxOf(other)); }
  Intersection(other) {
    const b = boxOf(other);
    return new Envelope(Math.max(this.MinX, minX(b)), Math.max(this.MinY, minY(b)), Math.min(this.MaxX, maxX(b)), Math.min(this.MaxY, maxY(b)));
  }
  Contains(other) { return contains(this, boxOf(other)); }
  Intersects(other) { return intersects(this, boxOf(other)); }
  DistanceTo(x, y) { return DistanceTo(this, x, y); }
  Equals(other) {
    if (other == null) return false;
    const b = boxOf(other);
    const same = (a, v) => a === v || (Number.isNaN(a) && Number.isNaN(v));
    return same(this.MinX, minX(b)) && same(this.MinY, minY(b)) && same(this.MaxX, maxX(b)) && same(this.MaxY, maxY(b));
  }
  /** Deterministic 32-bit value hash; equality treats -0 as 0 and all NaNs alike. */
  GetHashCode() {
    const view = new DataView(new ArrayBuffer(8));
    let hash = 2166136261;
    for (const value of [this.MinX, this.MinY, this.MaxX, this.MaxY]) {
      view.setFloat64(0, value === 0 ? 0 : Number.isNaN(value) ? NaN : value, true);
      hash = Math.imul(hash ^ view.getUint32(0, true), 16777619);
      hash = Math.imul(hash ^ view.getUint32(4, true), 16777619);
    }
    return hash | 0;
  }
  Deconstruct() { return [this.MinX, this.MinY, this.MaxX, this.MaxY]; }
  ToString() { return `Envelope { MinX = ${this.MinX}, MinY = ${this.MinY}, MaxX = ${this.MaxX}, MaxY = ${this.MaxY} }`; }
  get minX() { return this.MinX; }
  get minY() { return this.MinY; }
  get maxX() { return this.MaxX; }
  get maxY() { return this.MaxY; }
  get area() { return this.Area; }
  get margin() { return this.Margin; }
  extend(other) { return this.Extend(other); }
  intersection(other) { return this.Intersection(other); }
  contains(other) { return this.Contains(other); }
  intersects(other) { return this.Intersects(other); }
  distanceTo(x, y) { return this.DistanceTo(x, y); }
  equals(other) { return this.Equals(other); }
  toString() { return this.ToString(); }
}

Object.defineProperties(Envelope, {
  EmptyBounds: { value: new Envelope(Infinity, Infinity, -Infinity, -Infinity), enumerable: true },
  InfiniteBounds: { value: new Envelope(-Infinity, -Infinity, Infinity, Infinity), enumerable: true },
});

/** Distance from a bounding rectangle to a point, exactly as in RBushExtensions. */
export function DistanceTo(envelope, x, y) {
  const b = boxOf(envelope);
  const dx = x < minX(b) ? minX(b) - x : x > maxX(b) ? x - maxX(b) : 0;
  const dy = y < minY(b) ? minY(b) - y : y > maxY(b) ? y - maxY(b) : 0;
  return Math.sqrt(dx * dx + dy * dy);
}

const nodes = new WeakMap();
const internalNode = Symbol('internal R-tree node');
const readonlyArray = {
  set() { throw new TypeError('Node.Children is read-only.'); },
  deleteProperty() { throw new TypeError('Node.Children is read-only.'); },
  defineProperty() { throw new TypeError('Node.Children is read-only.'); },
  setPrototypeOf() { throw new TypeError('Node.Children is read-only.'); },
  preventExtensions() { throw new TypeError('Node.Children is read-only.'); },
};

/** The publicly inspectable, read-only node of a balanced R-tree. */
export class Node {
  constructor(token, items, height, getBox) {
    if (token !== internalNode) throw new TypeError('Nodes are created by RBush; inspect them through tree.Root.');
    nodes.set(this, { items, height, getBox, envelope: enclosing(items, getBox), children: new Proxy(items, readonlyArray) });
    Object.freeze(this);
  }
  get Children() { return nodes.get(this).children; }
  get Height() { return nodes.get(this).height; }
  get IsLeaf() { return this.Height === 1; }
  get Envelope() { return nodes.get(this).envelope; }
  get children() { return this.Children; }
  get height() { return this.Height; }
  get isLeaf() { return this.IsLeaf; }
  get leaf() { return this.IsLeaf; }
  get envelope() { return this.Envelope; }
}

function enclosing(items, getBox) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (let i = 0; i < items.length; i++) {
    const b = getBox(items[i]);
    x1 = Math.min(x1, minX(b)); y1 = Math.min(y1, minY(b));
    x2 = Math.max(x2, maxX(b)); y2 = Math.max(y2, maxY(b));
  }
  return new Envelope(x1, y1, x2, y2);
}

function reset(node) {
  const state = nodes.get(node);
  state.envelope = enclosing(state.items, state.getBox);
}

function add(node, item) {
  const state = nodes.get(node);
  state.items.push(item);
  state.envelope = extend(state.envelope, state.getBox(item));
}

function defaultEquals(a, b) {
  if (a === b) return true;
  if (a != null && typeof a.Equals === 'function') return Boolean(a.Equals(b));
  if (a != null && typeof a.equals === 'function') return Boolean(a.equals(b));
  return false;
}

function equality(comparer) {
  if (comparer == null) return defaultEquals;
  if (typeof comparer === 'function') return comparer;
  if (typeof comparer.Equals === 'function') return comparer.Equals.bind(comparer);
  if (typeof comparer.equals === 'function') return comparer.equals.bind(comparer);
  throw new TypeError('comparer must be a function or expose Equals(a, b).');
}

const trees = new WeakMap();

/** Reusable, dependency-free spatial database with the original .NET API. */
export class RBush {
  constructor(maxEntries = 9, comparer) {
    let accessor = boxOf;
    if (maxEntries !== null && typeof maxEntries === 'object') {
      const options = maxEntries;
      maxEntries = options.maxEntries ?? 9;
      comparer = options.comparer ?? comparer;
      if (options.getEnvelope !== undefined) {
        if (typeof options.getEnvelope !== 'function') throw new TypeError('getEnvelope must be a function.');
        accessor = options.getEnvelope;
      }
    }
    if (!Number.isSafeInteger(maxEntries)) throw new RangeError('maxEntries must be a safe integer.');
    maxEntries = Math.max(4, maxEntries);
    const getBox = item => item instanceof Node ? item.Envelope : accessor(item);
    trees.set(this, { maxEntries, minEntries: Math.max(2, Math.ceil(maxEntries * 0.4)), equals: equality(comparer), comparer, accessor, getBox, root: null, count: 0, invertedCount: 0 });
    this.Clear();
  }

  get Root() { return trees.get(this).root; }
  get Envelope() { return this.Root.Envelope; }
  get Count() { return trees.get(this).count; }
  get MaxEntries() { return trees.get(this).maxEntries; }

  Clear() {
    const state = trees.get(this);
    state.root = new Node(internalNode, [], 1, state.getBox);
    state.count = 0;
    state.invertedCount = 0;
  }

  Search(boundingBox) {
    const state = trees.get(this);
    const result = [];
    const query = boundingBox === undefined ? null : checkBox(boxOf(boundingBox));
    if (query && !intersects(this.Envelope, query)) return result;
    // All leaves have equal depth, so this queue has the same item order as
    // upstream Search()'s DFS and bounded Search(envelope)'s BFS.
    const queue = [state.root];
    for (let head = 0; head < queue.length; head++) {
      const node = queue[head];
      const items = nodes.get(node).items;
      if (node.IsLeaf) {
        for (let i = 0; i < items.length; i++) if (!query || intersects(state.getBox(items[i]), query)) result.push(items[i]);
      } else {
        for (let i = 0; i < items.length; i++) if (!query || intersects(items[i].Envelope, query)) queue.push(items[i]);
      }
    }
    return result;
  }

  Insert(item) {
    const state = trees.get(this);
    const box = checkBox(state.getBox(item));
    insert(state, item, state.root.Height);
    state.count++;
    if (inverted(box)) state.invertedCount++;
  }

  BulkLoad(items) {
    if (items == null || typeof items[Symbol.iterator] !== 'function') throw new TypeError('BulkLoad requires an iterable.');
    const data = Array.from(items);
    const state = trees.get(this);
    let invertedCount = 0;
    // Cache scalar sort keys during the required validation pass. Comparators
    // then avoid millions of repeated user getters and box-shape dispatches.
    const records = new Array(data.length);
    for (let index = 0; index < data.length; index++) {
      const item = data[index], box = checkBox(state.getBox(item));
      if (inverted(box)) invertedCount++;
      records[index] = { item, x: minX(box), y: minY(box) };
    }
    if (!data.length) return;
    state.invertedCount += invertedCount;
    if ((state.root.IsLeaf && nodes.get(state.root).items.length + data.length < state.maxEntries) || data.length < state.minEntries) {
      for (const item of data) { insert(state, item, state.root.Height); state.count++; }
      return;
    }
    const height = Math.ceil(Math.log(data.length) / Math.log(state.maxEntries));
    const rootMaxEntries = Math.ceil(data.length / Math.pow(state.maxEntries, height - 1));
    let dataRoot = buildNodes(state, records, height, rootMaxEntries);
    state.count += data.length;
    if (nodes.get(state.root).items.length === 0) state.root = dataRoot;
    else if (state.root.Height === dataRoot.Height) {
      if (nodes.get(state.root).items.length + nodes.get(dataRoot).items.length <= state.maxEntries) {
        for (const item of nodes.get(dataRoot).items) add(state.root, item);
      } else splitRoot(state, dataRoot);
    } else {
      if (state.root.Height < dataRoot.Height) [state.root, dataRoot] = [dataRoot, state.root];
      insert(state, dataRoot, state.root.Height - dataRoot.Height);
    }
  }

  Delete(item) {
    const state = trees.get(this);
    const box = checkBox(state.getBox(item));
    return remove(state, state.root, item, box);
  }

  Knn(k, x, y, maxDistance, predicate) { return Knn(this, k, x, y, maxDistance, predicate); }

  /** Fast existence query, stopping at the first intersection. */
  Collides(boundingBox) {
    const query = checkBox(boxOf(boundingBox));
    const state = trees.get(this);
    if (!intersects(state.root.Envelope, query)) return false;
    const stack = [state.root];
    while (stack.length) {
      const node = stack.pop();
      for (const item of nodes.get(node).items) {
        if (intersects(state.getBox(item), query)) {
          if (node.IsLeaf) return true;
          stack.push(item);
        }
      }
    }
    return false;
  }

  GetStats() {
    let nodeCount = 0, leafCount = 0, emptyLeafCount = 0;
    const stack = [this.Root];
    while (stack.length) {
      const node = stack.pop(); nodeCount++;
      if (node.IsLeaf) { leafCount++; if (!nodes.get(node).items.length) emptyLeafCount++; }
      else for (const child of nodes.get(node).items) stack.push(child);
    }
    return Object.freeze({ count: this.Count, height: this.Root.Height, nodeCount, leafCount, emptyLeafCount, maxEntries: this.MaxEntries, fillRatio: leafCount ? this.Count / (leafCount * this.MaxEntries) : 0 });
  }

  /** Recompute structural invariants; throws when externally mutated items made bounds stale. */
  Validate() {
    const state = trees.get(this);
    let count = 0, invertedCount = 0;
    const stack = [state.root];
    while (stack.length) {
      const node = stack.pop(), items = nodes.get(node).items;
      if (items.length > state.maxEntries) throw new Error('Node exceeds maxEntries.');
      if (!node.IsLeaf && items.length === 0) throw new Error('Internal nodes must contain child nodes.');
      for (const item of items) {
        checkBox(state.getBox(item));
        if (node.IsLeaf) { count++; if (inverted(state.getBox(item))) invertedCount++; }
        else {
          if (!(item instanceof Node) || item.Height !== node.Height - 1) throw new Error('Tree is not balanced.');
          stack.push(item);
        }
      }
      if (!node.Envelope.Equals(enclosing(items, state.getBox))) throw new Error('Node bounds are stale. Delete items before changing their envelope, then reinsert.');
    }
    if (count !== state.count) throw new Error('Count does not match the tree.');
    if (invertedCount !== state.invertedCount) throw new Error('Indexed item envelopes changed. Delete before changing envelopes, then reinsert.');
    return true;
  }

  /** Structural snapshot. Use a serializer for class instances or non-JSON payloads. */
  ToJSON(serializeItem = item => item) {
    if (typeof serializeItem !== 'function') throw new TypeError('serializeItem must be a function.');
    const encode = node => ({ height: node.Height, children: node.IsLeaf ? nodes.get(node).items.map(serializeItem) : nodes.get(node).items.map(encode) });
    return { format: 'RBushWeb', version: 1, maxEntries: this.MaxEntries, count: this.Count, root: encode(this.Root) };
  }

  /** Validate fully before replacing the current tree; retains comparer and accessor. */
  FromJSON(snapshot, deserializeItem = item => item) {
    if (typeof snapshot === 'string') snapshot = JSON.parse(snapshot);
    if (typeof deserializeItem !== 'function') throw new TypeError('deserializeItem must be a function.');
    if (!snapshot || snapshot.format !== 'RBushWeb' || snapshot.version !== 1 || !Number.isSafeInteger(snapshot.count) || snapshot.count < 0 || !Number.isSafeInteger(snapshot.maxEntries) || snapshot.maxEntries < 4) throw new TypeError('Invalid RBushWeb snapshot header.');
    const state = trees.get(this), seen = new WeakSet();
    let count = 0, invertedCount = 0;
    const decode = (value, expectedHeight) => {
      if (!value || typeof value !== 'object' || seen.has(value) || !Number.isInteger(value.height) || value.height < 1 || value.height > 64 || (expectedHeight !== undefined && value.height !== expectedHeight) || !Array.isArray(value.children) || value.children.length > snapshot.maxEntries) throw new TypeError('Invalid or cyclic RBushWeb node.');
      if (value.height > 1 && value.children.length === 0) throw new TypeError('Internal nodes must contain child nodes.');
      seen.add(value);
      const items = [];
      for (const child of value.children) {
        if (value.height === 1) {
          const item = deserializeItem(child);
          const box = checkBox(state.getBox(item));
          if (item instanceof Node) throw new TypeError('Leaf payload cannot be an R-tree Node.');
          items.push(item); count++;
          if (inverted(box)) invertedCount++;
        } else items.push(decode(child, value.height - 1));
      }
      return new Node(internalNode, items, value.height, state.getBox);
    };
    const root = decode(snapshot.root);
    if (count !== snapshot.count) throw new TypeError('Snapshot count does not match its items.');
    state.root = root; state.count = count; state.invertedCount = invertedCount; state.maxEntries = snapshot.maxEntries; state.minEntries = Math.max(2, Math.ceil(snapshot.maxEntries * 0.4));
    return this;
  }

  static FromJSON(snapshot, deserializeItem, options) { return new RBush(options).FromJSON(snapshot, deserializeItem); }
  get root() { return this.Root; }
  get envelope() { return this.Envelope; }
  get count() { return this.Count; }
  get size() { return this.Count; }
  get maxEntries() { return this.MaxEntries; }
  clear() { this.Clear(); return this; }
  search(boundingBox) { return this.Search(boundingBox); }
  all() { return this.Search(); }
  insert(item) { this.Insert(item); return this; }
  bulkLoad(items) { this.BulkLoad(items); return this; }
  load(items) { this.BulkLoad(items); return this; }
  delete(item) { return this.Delete(item); }
  remove(item) { return this.Delete(item); }
  knn(k, x, y, maxDistance, predicate) { return this.Knn(k, x, y, maxDistance, predicate); }
  collides(boundingBox) { return this.Collides(boundingBox); }
  getStats() { return this.GetStats(); }
  validate() { return this.Validate(); }
  // JSON.stringify passes a property key to toJSON, not a serializer.
  toJSON(serializeItem) { return this.ToJSON(typeof serializeItem === 'function' ? serializeItem : undefined); }
  fromJSON(snapshot, deserializeItem) { return this.FromJSON(snapshot, deserializeItem); }
  static fromJSON(snapshot, deserializeItem, options) { return RBush.FromJSON(snapshot, deserializeItem, options); }
  [Symbol.iterator]() { return this.Search()[Symbol.iterator](); }
}

Object.defineProperty(RBush, 'Node', { value: Node, enumerable: true });

function splitRoot(state, newNode) {
  state.root = new Node(internalNode, [state.root, newNode], state.root.Height + 1, state.getBox);
}

function insert(state, data, depth) {
  const box = state.getBox(data), path = [];
  let node = state.root;
  while (true) {
    path.push(node);
    if (node.IsLeaf || path.length === depth) break;
    const children = nodes.get(node).items;
    let next = children[0], nextArea = extendedArea(next.Envelope, box);
    for (let i = 1; i < children.length; i++) {
      const child = children[i], newArea = extendedArea(child.Envelope, box);
      // Upstream chooses the smallest resulting area, then original area.
      if (newArea > nextArea || (newArea === nextArea && child.Envelope.Area >= next.Envelope.Area)) continue;
      next = child; nextArea = newArea;
    }
    node = next;
  }
  add(node, data);
  for (let level = path.length - 1; level >= 0; level--) {
    node = path[level];
    if (nodes.get(node).items.length > state.maxEntries) {
      const sibling = splitNode(state, node);
      if (level === 0) splitRoot(state, sibling);
      else add(path[level - 1], sibling);
    } else reset(node);
  }
}

function potentialMargins(state, items) {
  let total = 0;
  for (const reverse of [false, true]) {
    let box = Envelope.EmptyBounds;
    for (let i = 0; i < items.length - state.minEntries; i++) {
      box = extend(box, state.getBox(items[reverse ? items.length - i - 1 : i]));
      if (i >= state.minEntries - 1) total += box.Margin;
    }
  }
  return total;
}

function splitNode(state, node) {
  const items = nodes.get(node).items;
  const byX = (a, b) => minX(state.getBox(a)) - minX(state.getBox(b));
  const byY = (a, b) => minY(state.getBox(a)) - minY(state.getBox(b));
  items.sort(byX);
  const marginX = potentialMargins(state, items);
  items.sort(byY);
  if (marginX < potentialMargins(state, items)) items.sort(byX);

  // Prefix/suffix envelopes remove the original repeated scans: O(M), not O(M²).
  const suffix = new Array(items.length);
  let box = Envelope.EmptyBounds;
  for (let i = items.length - 1; i >= 0; i--) suffix[i] = box = extend(box, state.getBox(items[i]));
  let left = Envelope.EmptyBounds, best = state.minEntries, bestOverlap = Infinity, bestArea = Infinity;
  for (let i = 1; i < items.length; i++) {
    left = extend(left, state.getBox(items[i - 1]));
    if (i < state.minEntries) continue;
    const right = suffix[i];
    const overlap = Math.max(Math.min(left.MaxX, right.MaxX) - Math.max(left.MinX, right.MinX), 0)
      * Math.max(Math.min(left.MaxY, right.MaxY) - Math.max(left.MinY, right.MinY), 0);
    const totalArea = left.Area + right.Area;
    // Upstream permits a final right-hand singleton; preserve the full candidate range.
    if (overlap < bestOverlap || (overlap === bestOverlap && totalArea < bestArea)) {
      best = i; bestOverlap = overlap; bestArea = totalArea;
    }
  }
  const sibling = new Node(internalNode, items.splice(best), node.Height, state.getBox);
  reset(node);
  return sibling;
}

function buildNodes(state, data, height, maxEntries) {
  if (data.length <= maxEntries) {
    return new Node(internalNode, height === 1 ? data.map(record => record.item) : [buildNodes(state, data, height - 1, state.maxEntries)], height, state.getBox);
  }
  data.sort((a, b) => a.x - b.x);
  const nodeSize = Math.ceil(data.length / maxEntries);
  const subSortLength = nodeSize * Math.ceil(Math.sqrt(maxEntries));
  const children = [];
  for (let i = 0; i < data.length; i += subSortLength) {
    const byY = data.slice(i, i + subSortLength).sort((a, b) => a.y - b.y);
    for (let j = 0; j < byY.length; j += nodeSize) children.push(buildNodes(state, byY.slice(j, j + nodeSize), height - 1, state.maxEntries));
  }
  return new Node(internalNode, children, height, state.getBox);
}

function remove(state, node, item, box) {
  if (!contains(node.Envelope, box)) return false;
  const items = nodes.get(node).items;
  if (node.IsLeaf) {
    let write = 0;
    for (let read = 0; read < items.length; read++) {
      if (!state.equals(items[read], item)) items[write++] = items[read];
      else if (state.invertedCount && inverted(state.getBox(items[read]))) state.invertedCount--;
    }
    const removed = items.length - write;
    if (!removed) return false;
    items.length = write; state.count -= removed; reset(node);
    return true;
  }
  let removed = false;
  for (const child of items) removed = remove(state, child, item, box) || removed;
  if (removed) reset(node);
  return removed;
}

function compareQueue(a, b) {
  if (a.distance < b.distance) return -1;
  if (a.distance > b.distance) return 1;
  // A lexicographic path reproduces stable Search order for equidistant items,
  // even when branches were discovered in a different geometric order.
  const n = Math.min(a.path.length, b.path.length);
  for (let i = 0; i < n; i++) if (a.path[i] !== b.path[i]) return a.path[i] - b.path[i];
  return a.path.length - b.path.length;
}

class MinHeap {
  items = [];
  push(value) {
    const items = this.items;
    let index = items.length;
    items.push(value);
    while (index > 0) {
      const parent = (index - 1) >>> 1;
      if (compareQueue(items[parent], value) <= 0) break;
      items[index] = items[parent]; index = parent;
    }
    items[index] = value;
  }
  pop() {
    const items = this.items, first = items[0], last = items.pop();
    if (items.length) {
      let index = 0;
      while (index * 2 + 1 < items.length) {
        let child = index * 2 + 1;
        if (child + 1 < items.length && compareQueue(items[child + 1], items[child]) < 0) child++;
        if (compareQueue(last, items[child]) <= 0) break;
        items[index] = items[child]; index = child;
      }
      items[index] = last;
    }
    return first;
  }
}

/** k <= 0 means all matching neighbors. maxDistance is inclusive and Euclidean. */
export function Knn(tree, k, x, y, maxDistance, predicate) {
  if (tree == null || typeof tree.Search !== 'function') throw new TypeError('tree must implement ISpatialIndex.Search.');
  if (!Number.isSafeInteger(k)) throw new RangeError('k must be a safe integer.');
  if (!numeric(x) || !numeric(y)) throw new TypeError('Query coordinates must be numbers other than NaN.');
  if (maxDistance != null && !numeric(maxDistance)) throw new TypeError('maxDistance must be a number other than NaN.');
  if (predicate != null && typeof predicate !== 'function') throw new TypeError('predicate must be a function.');
  if (maxDistance != null && maxDistance < 0) return [];
  const state = trees.get(tree);
  const query = maxDistance == null ? null : new Envelope(x - maxDistance, y - maxDistance, x + maxDistance, y + maxDistance);
  if (!state || state.invertedCount || !Number.isFinite(x) || !Number.isFinite(y)) {
    // Third-party indexes and inverted envelopes retain upstream stable sorting.
    // An inverted rectangle's distance need not bound its children's distances.
    // NaN query bounds can arise from Infinity - Infinity; upstream Search finds none.
    if (query && [query.MinX, query.MinY, query.MaxX, query.MaxY].some(Number.isNaN)) return [];
    const getBox = state ? state.getBox : boxOf;
    const candidates = (query ? tree.Search(query) : tree.Search()).map(item => ({ item, distance: DistanceTo(getBox(item), x, y) }));
    candidates.sort((a, b) => a.distance - b.distance);
    const result = [];
    for (const candidate of candidates) {
      if (maxDistance != null && candidate.distance > maxDistance) break;
      if (!predicate || predicate(candidate.item)) result.push(candidate.item);
      if (k > 0 && result.length === k) break;
    }
    return result;
  }
  if (!state.count || (query && !intersects(state.root.Envelope, query))) return [];
  const heap = new MinHeap(), result = [];
  heap.push({ item: state.root, distance: DistanceTo(state.root.Envelope, x, y), path: [], isNode: true });
  while (heap.items.length) {
    const entry = heap.pop();
    if (maxDistance != null && entry.distance > maxDistance) break;
    if (entry.isNode) {
      const node = entry.item, items = nodes.get(node).items;
      for (let i = 0; i < items.length; i++) {
        const item = items[i], b = state.getBox(item);
        if (query && !intersects(b, query)) continue;
        const distance = DistanceTo(b, x, y);
        if (maxDistance != null && distance > maxDistance) continue;
        heap.push({ item, distance, path: entry.path.concat(i), isNode: !node.IsLeaf });
      }
    } else {
      if (!predicate || predicate(entry.item)) result.push(entry.item);
      if (k > 0 && result.length === k) break;
    }
  }
  return result;
}

export const RBushExtensions = Object.freeze({ Knn, DistanceTo, knn: Knn, distanceTo: DistanceTo });
export { Knn as knn, DistanceTo as distanceTo };
export default RBush;
