/** Four double-precision coordinates, using the original .NET names. */
export interface PascalBounds {
  readonly MinX: number;
  readonly MinY: number;
  readonly MaxX: number;
  readonly MaxY: number;
}

/** Convenient interoperability with common JavaScript bounding-box objects. */
export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export type EnvelopeLike = PascalBounds | Bounds;

/** Structural equivalent of RBush.ISpatialData; no runtime base class required. */
export interface ISpatialData {
  readonly Envelope: EnvelopeLike;
}

export type SpatialData = ISpatialData | { readonly envelope: EnvelopeLike } | EnvelopeLike;

export interface ISpatialIndex<T> {
  Search(): readonly T[];
  Search(boundingBox: EnvelopeLike): readonly T[];
}

export interface ISpatialDatabase<T> extends ISpatialIndex<T> {
  Insert(item: T): void;
  Delete(item: T): boolean;
  Clear(): void;
  BulkLoad(items: Iterable<T>): void;
}

export interface IEqualityComparer<T> {
  Equals(a: T, b: T): boolean;
  GetHashCode?(item: T): number;
}

export type EqualityComparer<T> = IEqualityComparer<T> | { equals(a: T, b: T): boolean } | ((a: T, b: T) => boolean);

/** Immutable replacement for the readonly Envelope record struct. */
export class Envelope implements PascalBounds, Bounds {
  constructor();
  constructor(MinX: number, MinY: number, MaxX: number, MaxY: number);
  constructor(bounds: EnvelopeLike | ISpatialData);
  readonly MinX: number;
  readonly MinY: number;
  readonly MaxX: number;
  readonly MaxY: number;
  readonly Area: number;
  readonly Margin: number;
  static readonly EmptyBounds: Envelope;
  static readonly InfiniteBounds: Envelope;
  Extend(other: EnvelopeLike | ISpatialData): Envelope;
  Intersection(other: EnvelopeLike | ISpatialData): Envelope;
  Contains(other: EnvelopeLike | ISpatialData): boolean;
  Intersects(other: EnvelopeLike | ISpatialData): boolean;
  DistanceTo(x: number, y: number): number;
  Equals(other: unknown): boolean;
  /** Deterministic hash; not a binary-compatible .NET runtime hash. */
  GetHashCode(): number;
  Deconstruct(): [MinX: number, MinY: number, MaxX: number, MaxY: number];
  ToString(): string;
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly area: number;
  readonly margin: number;
  extend(other: EnvelopeLike | ISpatialData): Envelope;
  intersection(other: EnvelopeLike | ISpatialData): Envelope;
  contains(other: EnvelopeLike | ISpatialData): boolean;
  intersects(other: EnvelopeLike | ISpatialData): boolean;
  distanceTo(x: number, y: number): number;
  equals(other: unknown): boolean;
  toString(): string;
}

/** Node constructors and mutations are internal; traverse through RBush.Root. */
export class Node<T = ISpatialData> implements ISpatialData {
  private constructor();
  readonly Children: readonly (T | Node<T>)[];
  readonly Height: number;
  readonly IsLeaf: boolean;
  readonly Envelope: Envelope;
  readonly children: readonly (T | Node<T>)[];
  readonly height: number;
  readonly isLeaf: boolean;
  readonly leaf: boolean;
  readonly envelope: Envelope;
}

export interface RBushOptions<T> {
  /** Clamped to at least 4; defaults to 9. */
  maxEntries?: number;
  comparer?: EqualityComparer<T>;
  /** Supply coordinates for arbitrary application payloads. */
  getEnvelope?: (item: T) => EnvelopeLike;
}

export interface RBushStats {
  readonly count: number;
  readonly height: number;
  readonly nodeCount: number;
  readonly leafCount: number;
  readonly emptyLeafCount: number;
  readonly maxEntries: number;
  readonly fillRatio: number;
}

/** Node envelopes are recomputed on import instead of trusting stored bounds. */
export interface SerializedNode<T> {
  height: number;
  children: (T | SerializedNode<T>)[];
}

export interface RBushSnapshot<T> {
  format: 'RBushWeb';
  version: 1;
  maxEntries: number;
  count: number;
  root: SerializedNode<T>;
}

/** R-tree database supporting the PascalCase API and JavaScript aliases. */
export class RBush<T = ISpatialData> implements ISpatialDatabase<T>, Iterable<T> {
  constructor();
  constructor(maxEntries: number, comparer?: EqualityComparer<T>);
  constructor(options: RBushOptions<T>);
  static readonly Node: typeof Node;
  readonly Root: Node<T>;
  readonly Envelope: Envelope;
  readonly Count: number;
  readonly MaxEntries: number;
  Clear(): void;
  Search(): T[];
  Search(boundingBox: EnvelopeLike): T[];
  Insert(item: T): void;
  BulkLoad(items: Iterable<T>): void;
  /** Remove every equivalent item found in branches containing item's envelope. */
  Delete(item: T): boolean;
  /** k <= 0 returns all neighbors; maxDistance is an inclusive Euclidean radius. */
  Knn(k: number, x: number, y: number, maxDistance?: number | null, predicate?: ((item: T) => boolean) | null): T[];
  Collides(boundingBox: EnvelopeLike): boolean;
  GetStats(): RBushStats;
  /** Throws on invalid structure, count or stale envelopes; otherwise returns true. */
  Validate(): true;
  ToJSON(): RBushSnapshot<T>;
  ToJSON<U>(serializeItem: (item: T) => U): RBushSnapshot<U>;
  FromJSON(snapshot: RBushSnapshot<T> | string): this;
  FromJSON<U>(snapshot: RBushSnapshot<U> | string, deserializeItem: (item: U) => T): this;
  static FromJSON<T>(snapshot: RBushSnapshot<T> | string): RBush<T>;
  static FromJSON<T, U>(snapshot: RBushSnapshot<U> | string, deserializeItem: ((item: U) => T) | undefined, options?: RBushOptions<T> | number): RBush<T>;
  readonly root: Node<T>;
  readonly envelope: Envelope;
  readonly count: number;
  readonly size: number;
  readonly maxEntries: number;
  clear(): this;
  search(boundingBox?: EnvelopeLike): T[];
  all(): T[];
  insert(item: T): this;
  bulkLoad(items: Iterable<T>): this;
  load(items: Iterable<T>): this;
  delete(item: T): boolean;
  remove(item: T): boolean;
  knn(k: number, x: number, y: number, maxDistance?: number | null, predicate?: ((item: T) => boolean) | null): T[];
  collides(boundingBox: EnvelopeLike): boolean;
  getStats(): RBushStats;
  validate(): true;
  toJSON(): RBushSnapshot<T>;
  toJSON<U>(serializeItem: (item: T) => U): RBushSnapshot<U>;
  fromJSON(snapshot: RBushSnapshot<T> | string): this;
  fromJSON<U>(snapshot: RBushSnapshot<U> | string, deserializeItem: (item: U) => T): this;
  static fromJSON<T>(snapshot: RBushSnapshot<T> | string): RBush<T>;
  static fromJSON<T, U>(snapshot: RBushSnapshot<U> | string, deserializeItem: ((item: U) => T) | undefined, options?: RBushOptions<T> | number): RBush<T>;
  [Symbol.iterator](): IterableIterator<T>;
}

/** Supports any compatible index, and uses tree traversal for RBush instances. */
export function Knn<T>(tree: ISpatialIndex<T>, k: number, x: number, y: number, maxDistance?: number | null, predicate?: ((item: T) => boolean) | null): T[];
export function DistanceTo(envelope: EnvelopeLike | ISpatialData, x: number, y: number): number;
export const RBushExtensions: Readonly<{
  Knn: typeof Knn;
  DistanceTo: typeof DistanceTo;
  knn: typeof Knn;
  distanceTo: typeof DistanceTo;
}>;
export { Knn as knn, DistanceTo as distanceTo };
export default RBush;
