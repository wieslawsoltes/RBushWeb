import * as engine from '../../src/index.js';
function validate(item) {
  if (typeof item?.id !== 'string' || !item.id.length) throw new TypeError('A nonempty string item id is required.');
  const b = item.envelope;
  if (!b || ![b.minX, b.minY, b.maxX, b.maxY].every(Number.isFinite) || b.minX > b.maxX || b.minY > b.maxY) throw new RangeError('Spatial item bounds must be finite and ordered.');
  return item;
}
/** Retains native references by stable id, so CLR DTO round-trips do not break identity-based deletion. */
export class BlazorSpatialIndex {
  constructor(maxEntries = 9) { this.tree = new engine.RBush(maxEntries); this.items = new Map(); this.disposed = false; }
  check() { if (this.disposed) throw new Error('Spatial index is disposed.'); }
  get Count() { this.check(); return this.tree.Count; }
  Insert(item) { this.check(); validate(item); if (this.items.has(item.id)) throw new Error(`Duplicate spatial id: ${item.id}`); this.tree.Insert(item); this.items.set(item.id, item); }
  Upsert(item) { this.check(); validate(item); const previous = this.items.get(item.id); if (previous) this.tree.Delete(previous); this.tree.Insert(item); this.items.set(item.id, item); }
  Delete(id) { this.check(); const item = this.items.get(id); if (!item) return false; const before = this.tree.Count; this.tree.Delete(item); if (this.tree.Count === before) throw new Error('Native removal failed.'); this.items.delete(id); return true; }
  BulkLoad(values, replace = false) {
    this.check(); const items = Array.from(values, validate); const ids = new Set(replace ? [] : this.items.keys());
    for (const item of items) { if (ids.has(item.id)) throw new Error(`Duplicate spatial id: ${item.id}`); ids.add(item.id); }
    const next = new engine.RBush(this.tree.MaxEntries); next.BulkLoad(replace ? items : [...this.items.values(), ...items]);
    this.tree = next; this.items = new Map((replace ? items : [...this.items.values(), ...items]).map(item => [item.id, item]));
  }
  Search(bounds) { this.check(); return bounds == null ? this.tree.Search() : this.tree.Search(bounds); }
  Collides(bounds) { this.check(); return this.tree.Collides(bounds); }
  Knn(k, x, y, maxDistance = null, predicate = null) { this.check(); return this.tree.Knn(k, x, y, maxDistance, predicate); }
  GetStats() { this.check(); return this.tree.GetStats(); }
  Validate() { this.check(); return this.tree.Validate(); }
  Clear() { this.check(); this.tree.Clear(); this.items.clear(); }
  Export() { this.check(); return JSON.stringify({ version: 1, maxEntries: this.tree.MaxEntries, items: [...this.items.values()] }); }
  Import(json) {
    this.check(); const data = JSON.parse(json);
    if (data?.version !== 1 || !Array.isArray(data.items) || !Number.isSafeInteger(data.maxEntries) || data.maxEntries < 4) throw new Error('Unsupported spatial snapshot.');
    const replacement = new BlazorSpatialIndex(data.maxEntries);
    replacement.BulkLoad(data.items, true); replacement.Validate();
    this.tree = replacement.tree; this.items = replacement.items;
  }
  Dispose() { if (this.disposed) return; this.tree.Clear(); this.items.clear(); this.disposed = true; }
}
export const api = { ...engine, BlazorSpatialIndex };
