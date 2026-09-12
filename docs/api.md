# API and upstream compatibility

The reference is [viceroypenguin/RBush at 101b6fb915215d9d30294a1178fe09ebd6929d73](https://github.com/viceroypenguin/RBush/tree/101b6fb915215d9d30294a1178fe09ebd6929d73). All public spatial operations are available with their original PascalCase names. `RBush`, `Envelope`, `Node`, `RBushExtensions`, `Knn`, and `DistanceTo` are named exports; `RBush` is also the default export.

## Public API mapping

| Upstream | JavaScript / TypeScript |
| --- | --- |
| `RBush<T>()` | `new RBush<T>()` in TypeScript; `new RBush()` in JavaScript |
| `RBush<T>(maxEntries)` | `new RBush(maxEntries)`; default 9, minimum 4 |
| `RBush<T>(maxEntries, comparer)` | `new RBush(maxEntries, comparer)`; equality function or object with `Equals(a,b)` / `equals(a,b)` |
| `Root` | Read-only `Node` object |
| `Envelope` | Immutable aggregate bounds of the root |
| `Count` | Number of stored entries, including duplicates |
| `Clear()` | Clears the tree; returns `undefined` |
| `Search()` | New array containing every entry |
| `Search(in Envelope)` | New array of entries intersecting the query, including touching edges |
| `Insert(T)` | Inserts one item; returns `undefined` |
| `BulkLoad(IEnumerable<T>)` | Accepts any synchronous iterable, consumed once; leaves the caller's array order unchanged; returns `undefined` |
| `Delete(T)` | Returns a boolean; deletes all equal entries in the spatially eligible leaves |
| `Node.Children` | Live read-only array view of leaf items or child nodes |
| `Node.Height` | Leaf height is 1 |
| `Node.IsLeaf` | Whether children are payload items |
| `Node.Envelope` | Immutable aggregate node bounds |
| `ISpatialData.Envelope` | Structural TypeScript interface and duck-typed JavaScript property |
| `ISpatialIndex<T>` | Structural interface for both `Search` overloads |
| `ISpatialDatabase<T>` | Extends the index interface with insertion, deletion, bulk loading, and clearing |
| `RBushExtensions.Knn(tree,k,x,y,maxDistance?,predicate?)` | Exported helper and `tree.Knn(k,x,y,maxDistance?,predicate?)` |
| `RBushExtensions.DistanceTo(envelope,x,y)` | Exported helper and `envelope.DistanceTo(x,y)` |

Node construction remains internal; inspect nodes through `tree.Root`. `RBush.Node` and the named `Node` export identify the same class. `Node.Items` is internal in C# and is not exposed by this port.

## Envelope

`new Envelope(minX, minY, maxX, maxY)` produces a frozen value object with `MinX`, `MinY`, `MaxX`, and `MaxY`. `new Envelope()` produces the all-zero value. A JavaScript convenience overload accepts a PascalCase or lowercase bounding-box object.

| Member | Behavior |
| --- | --- |
| `Area` | `max(MaxX-MinX,0) * max(MaxY-MinY,0)` |
| `Margin` | Sum of clamped width and height; half the perimeter |
| `Extend(other)` | New envelope enclosing both values |
| `Intersection(other)` | New coordinate intersection; disjoint intersections retain reversed limits |
| `Contains(other)` | Inclusive coordinate containment |
| `Intersects(other)` | Inclusive overlap; touching counts |
| `DistanceTo(x,y)` | Euclidean distance to the envelope, zero inside |
| `EmptyBounds` | Static `(+Infinity,+Infinity,-Infinity,-Infinity)` sentinel |
| `InfiniteBounds` | Static `(-Infinity,-Infinity,+Infinity,+Infinity)` sentinel |
| `Equals(other)` | Coordinate value equality; NaNs compare equal and signed zero compares equal |
| `GetHashCode()` | Deterministic signed 32-bit coordinate hash consistent with `Equals` |
| `Deconstruct()` | `[MinX,MinY,MaxX,MaxY]` array for destructuring |
| `ToString()` | Human-readable coordinate representation |

Lowercase coordinate/property/method aliases are provided. Geometry arithmetic uses JavaScript's IEEE-754 numbers, matching the numeric representation of C# `double`. Envelopes preserve reversed and infinite coordinates, including the upstream sentinels. Index insertion and search reject NaN/non-numeric coordinates. This validation is stricter than upstream's implicit handling of NaN.

## Equality, deletion, and moving items

Default equality uses object identity; when an item defines `Equals(other)` or `equals(other)`, that supplies value equality. Custom comparers support C#-style objects or JavaScript functions:

```js
const tree = new RBush(16, { Equals: (left, right) => left.id === right.id });
```

Like upstream, deletion traverses only nodes whose envelope contains the supplied item's envelope. It removes every equal entry in eligible leaves and adjusts `Count` by the actual number removed. It retains empty leaves and tree height after deletion. `Clear()` resets the root to a new empty leaf.

Do not mutate an indexed envelope. Delete the item using its old envelope, update the coordinates, and reinsert it. The custom accessor and equality callback should be pure. They must not mutate the tree while an operation is running.

## Nearest-neighbor queries

```js
tree.Knn(k, x, y, maxDistance = undefined, predicate = undefined);
RBushExtensions.Knn(customIndex, k, x, y, maxDistance, predicate);
```

`k > 0` limits the count; `k <= 0` returns all eligible neighbors. `null` or `undefined` means no maximum distance. The radius is inclusive; negative radii return an empty array. The predicate filters entries before the count limit is applied. Equal distances retain `Search()` traversal order. The helper also works with a custom object exposing `Search()` and `Search(envelope)`.

The optimized RBush path uses a min-heap to visit nearby nodes first. Lexicographic tree paths preserve stable order for distance ties. Custom indexes and trees containing inverted item envelopes use the upstream scan/sort behavior; inverted limits do not support the distance lower bounds needed for heap pruning. As in the upstream library, distance measures the envelope rather than the item's center, and coordinates are planar, not geodesic.

## JavaScript additions

The constructor also accepts an options object:

```js
const tree = new RBush({
  maxEntries: 16,
  comparer: (a, b) => a.id === b.id,
  getEnvelope: item => item.bounds,
});
tree.Insert({ id: 'a', bounds: { minX: 1, minY: 2, maxX: 3, maxY: 4 } });
```

Without an accessor, items can expose `Envelope`, `envelope`, or direct PascalCase/lowercase bounding-box coordinates. This is an addition to the upstream `ISpatialData` convention.

| Addition | Behavior |
| --- | --- |
| `MaxEntries` | Effective node capacity |
| `Collides(envelope)` | Boolean intersection query that stops at the first match |
| `GetStats()` | Frozen object with `count`, `height`, `nodeCount`, `leafCount`, `emptyLeafCount`, `maxEntries`, and `fillRatio` |
| `Validate()` | Returns `true`, or throws for invalid bounds, balance, capacity, or counts |
| `ToJSON(serializer?)` | Creates a versioned structural snapshot |
| `FromJSON(snapshot, reviver?)` | Validates before replacing the tree; retains the receiver's comparer/accessor and restores snapshot capacity |
| `RBush.FromJSON(snapshot, reviver?, options?)` | Builds a new tree from a snapshot |
| `[Symbol.iterator]()` | Iterates over a new snapshot array of the tree's items |

Lowercase aliases: `root`, `envelope`, `count`, `size`, `maxEntries`, `clear`, `search`, `all`, `insert`, `bulkLoad`, `load`, `delete`, `remove`, `knn`, `collides`, `getStats`, `validate`, `toJSON`, and `fromJSON`. Lowercase `clear`, `insert`, `bulkLoad`, and `load` return the tree for chaining. PascalCase mutators preserve upstream void returns; both deletion forms return a boolean. These aliases follow this port's contract and do not imply API equivalence with another npm package named `rbush`.

## Serialization

```js
const text = JSON.stringify(tree); // invokes toJSON()
const restored = RBush.FromJSON(text);
restored.Validate();

// Preserve custom classes by explicitly serializing/reviving each item.
const snapshot = tree.ToJSON(item => ({ id: item.id, box: item.Envelope.Deconstruct() }));
const revived = RBush.FromJSON(snapshot,
  data => ({ id: data.id, Envelope: new Envelope(...data.box) }));
```

Snapshots contain `format: 'RBushWeb'`, `version: 1`, `maxEntries`, `count`, and a root with `height`/`children`. Bounds are recomputed from payloads. Loading validates node shapes, capacity, height balance, cycles, coordinates, and total count before replacing live state. Comparer functions and custom accessors are runtime behavior; pass them as options when constructing a new restored tree.

Default snapshots preserve references until converted to text. JSON does not preserve object prototypes, shared identity, `Infinity`, `NaN`, `BigInt`, functions, or cycles in payloads. Use application-specific serializer/reviver functions for these values. Empty-tree snapshots need no special handling because node bounds are recomputed. Snapshots with infinite payload coordinates require an explicit representation and reviver; silent `Infinity`-to-`null` corruption is rejected on import. Snapshots are not compatible with the unrelated `mourner/rbush` JSON format.

## Language adaptations and behavioral boundaries

- TypeScript generics/interfaces provide compile-time contracts; JavaScript has no .NET runtime generic type metadata. No .NET runtime or WASM is required.
- `in`/`ref readonly` parameters become ordinary arguments; freezing protects `Envelope` coordinates. JavaScript object references are not copied like C# structs. Methods that construct new geometry return a new frozen object.
- C# record `==`, `!=`, and `with` syntax cannot be overloaded in JavaScript. Use `Equals`, negate its result, or construct a new `Envelope`. `GetHashCode` is internally consistent, not a byte-for-byte match for .NET's process/runtime-dependent record hash. `ToString` reports coordinates without attempting to reproduce every culture or compiler-generated property formatting choice.
- Generic variance and `IReadOnlyList<T>` become structural TypeScript types/arrays. Search returns an independent mutable result array. Node `Children` prevents structural edits; payload objects remain application-owned.
- The port preserves upstream bulk-packing heights, merge rules, deletion retention, split-candidate range, and nearest tie behavior. JavaScript's stable array sort can choose a different arrangement from .NET's unstable `List.Sort` for coordinate ties during splitting; the data/query contract is unchanged.
- Numeric arguments are checked: capacities and `k` must be safe integers; invalid coordinate types and NaN index/query coordinates are rejected. .NET-specific signed assembly distribution, platform reflection, and serialization attributes have no JavaScript analogue.
- The library is synchronous. Use an application Web Worker when a large load must avoid blocking the main thread. Concurrent mutation from callbacks is unsupported. The demo renderer is independent of the spatial index.

See [test-parity.md](test-parity.md) for the complete test mapping and [performance.md](performance.md) for measured-workload methodology.
