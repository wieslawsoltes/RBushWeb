# RBushWeb

[![CI](https://github.com/wieslawsoltes/RBushWeb/actions/workflows/ci.yml/badge.svg)](https://github.com/wieslawsoltes/RBushWeb/actions/workflows/ci.yml)
[![npm publishing](https://github.com/wieslawsoltes/RBushWeb/actions/workflows/npm-publish.yml/badge.svg)](https://github.com/wieslawsoltes/RBushWeb/actions/workflows/npm-publish.yml)
[![npm version](https://img.shields.io/npm/v/%40wieslawsoltes%2Frbushweb)](https://www.npmjs.com/package/@wieslawsoltes/rbushweb)
[![npm downloads](https://img.shields.io/npm/dm/%40wieslawsoltes%2Frbushweb)](https://www.npmjs.com/package/@wieslawsoltes/rbushweb)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A fast, reusable, dependency-free JavaScript port of [viceroypenguin/RBush](https://github.com/viceroypenguin/RBush), preserving its .NET-style public API for spatial indexing of points and rectangles. Use it in browsers, Web Workers, Node, or any framework. The library has no DOM dependency; the included **Spatial Lab** is a separate plain HTML/JavaScript application.

**[API and compatibility](docs/api.md)** · **[Upstream test mapping](docs/test-parity.md)** · **[Performance](docs/performance.md)** · **[Release downloads](https://github.com/wieslawsoltes/RBushWeb/releases)** · **[Publishing](docs/publishing.md)**

## Install

```sh
npm install @wieslawsoltes/rbushweb
```

```js
import { RBush, Envelope } from '@wieslawsoltes/rbushweb';

const tree = new RBush(9);
const station = { id: 'station', Envelope: new Envelope(10, 20, 10, 20) };
tree.Insert(station);
tree.BulkLoad([
  { id: 'park', Envelope: new Envelope(15, 15, 25, 30) },
  { id: 'library', Envelope: new Envelope(30, 35, 40, 45) },
]);

const intersecting = tree.Search(new Envelope(0, 0, 20, 25));
const nearest = tree.Knn(2, 12, 18);
const all = tree.Search();
console.log(tree.Count, intersecting, nearest, all);
tree.Delete(station); // true; removes matching entries using the configured comparer
tree.Clear();
```

CommonJS is supported with `const { RBush, Envelope } = require('@wieslawsoltes/rbushweb')`. TypeScript declarations are included for both module systems.

## Browser usage without a bundler

Serve the package's `dist` directory or use a pinned CDN module URL:

```html
<script type="module">
  import { RBush, Envelope } from 'https://cdn.jsdelivr.net/npm/@wieslawsoltes/rbushweb@0.1.0/dist/index.js';
  const tree = new RBush();
  tree.Insert({ Envelope: new Envelope(0, 0, 20, 20) });
  console.log(tree.Search(new Envelope(10, 10, 30, 30)));
</script>
```

For a classic script, load `dist/rbushweb.min.js` and access `RBushWeb.RBush` and `RBushWeb.Envelope`. No build step is needed to use `src/index.js` directly as an ES module.

## Features

- R-tree insertion with overlap-based splitting; bulk loading and merging into existing trees.
- Inclusive rectangular queries and enumeration of all stored objects.
- Nearest-neighbor queries for points **and rectangles**, with a distance limit and predicate.
- Custom equality comparers, duplicate deletion, accurate counts, and clearing.
- Immutable `Envelope` geometry: union, intersection, containment, overlap, distance, area, margin, and empty/infinite bounds.
- Inspectable `Root`, node `Children`, `Height`, `IsLeaf`, and aggregate `Envelope`.
- PascalCase methods matching C# usage, plus lowercase aliases and plain-object bounding boxes.
- Additional collision queries, tree validation/statistics, and validated JSON tree round trips.
- ESM, CommonJS, minified browser global, source maps, and generic TypeScript interfaces.

### Custom data and equality

```js
const tree = new RBush(16, { Equals: (a, b) => a.id === b.id });
tree.Insert({ id: 7, Envelope: new Envelope(1, 2, 3, 4) });
tree.Delete({ id: 7, Envelope: new Envelope(1, 2, 3, 4) });

// JavaScript bounding-box objects work directly too.
const boxes = new RBush();
boxes.BulkLoad([{ minX: 0, minY: 0, maxX: 1, maxY: 1 }]);
console.log(boxes.search({ minX: 0, minY: 0, maxX: 2, maxY: 2 }));
```

Keep indexed envelopes fixed. To move an item, delete it using its old bounds, change its envelope, then insert it again. A custom comparer should identify entries with compatible spatial bounds: deletion prunes branches using the supplied item's envelope, as upstream does.

### Nearest neighbors

```js
const closest = tree.Knn(10, x, y);
const nearby = tree.Knn(0, x, y, 100); // k <= 0 means all qualifying neighbors
const eligible = tree.Knn(5, x, y, null, item => item.active);
```

Distance is Euclidean distance to the rectangle, zero for a point inside it. Maximum distance is inclusive. Results are ordered by distance; ties follow the tree's enumeration order. Coordinates are planar numbers; longitude/latitude distances are not geodesic distances.

## Spatial Lab sample

```sh
npm ci
npm run dev
# Open http://127.0.0.1:5173/
```

Explore generated points and rectangles, bulk versus individual insertion, query results, nearest neighbors, custom filters, node bounds, editing, and JSON import/export. The sample uses a Canvas2D viewport with light and dark themes; rendering and indexing are separate modules.

`npm run build:demo` produces a self-contained `site/` directory after `npm run build`. Every release includes the browser modules and sample as separate archives. An optional GitHub Pages workflow is included.

## Development and validation

```sh
npm ci
npm run check             # Build, declarations, upstream and additional tests, sample build
npm run test:package      # Install the packed package; ESM/CJS/TS/browser-global consumers
npx playwright install chromium
npm run test:browser      # Real browser interactions with the sample
npm run benchmark        # Seeded correctness-checked measurements, through 100,000 items
```

All upstream test methods and fixtures are retained and mapped in [test-parity.md](docs/test-parity.md). Additional independent scan/sort oracles exercise mixed operations, spatial bounds, nearest neighbors, equal-distance results, duplicates, serialization, and JavaScript adapters. The exact upstream test sources are retained in `test/upstream/`.

The port targets upstream commit [`101b6fb`](https://github.com/viceroypenguin/RBush/commit/101b6fb915215d9d30294a1178fe09ebd6929d73). C# language-only features such as `in`, `ref readonly`, record operators, and runtime generic type metadata are adapted to JavaScript values and TypeScript interfaces; see the [compatibility notes](docs/api.md). This is a source/API port, not a .NET assembly host.

## Releases

CI verifies Node 22 and 24, runs browser and package-consumer tests, builds immutable release artifacts, and publishes new versions to npm with provenance using `NPM_TOKEN`. The published tarball must match the GitHub release checksum and pass fresh public-registry consumer verification. See [publishing.md](docs/publishing.md) for the release and retry procedure.

## License and attribution

MIT. The source port and original tests derive from [viceroypenguin/RBush](https://github.com/viceroypenguin/RBush), which credits [Vladimir Agafonkin's RBush](https://github.com/mourner/rbush) as its algorithmic origin. Release infrastructure follows [ReactiveWeb](https://github.com/wieslawsoltes/ReactiveWeb). Copyright and permission notices are preserved in [LICENSE](LICENSE) and [NOTICE](NOTICE).
