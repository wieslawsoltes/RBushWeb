# Performance and reproducible measurements

The repository includes a deterministic, dependency-free Node benchmark. Run it on
the same machine and runtime before comparing revisions:

```sh
npm run benchmark
node scripts/benchmark.mjs --size 1000 --samples 3 --warmup 1
node scripts/benchmark.mjs --size 10000,100000 --samples 7 --json > benchmark-results.json
```

Use `node scripts/benchmark.mjs --help` for all options. The default sizes are
1,000, 10,000, and 100,000 items. Each size runs four deterministic datasets:
uniform points, uniform rectangles, clustered points, and clustered rectangles.
The PRNG seed is configurable; a fixed seed preserves the data and query workload.
The benchmark does not require a browser, network access, or external packages.

## What is measured

Every operation receives two untimed warmup runs followed by five measured runs
by default. The console table reports the median; JSON also contains every raw
sample, the minimum, and the maximum. The header records Node, V8, OS, architecture,
CPU model, logical CPU count, system memory, Node flags, the seed, and workload
settings. System memory and logical CPU count may reflect the container host,
rather than the resources available to the benchmark process.

| Measurement | Timed work | Setup excluded from timing |
| --- | --- | --- |
| Bulk load | `BulkLoad(items)` into an empty tree | Data generation, tree construction |
| Individual insertion | One `Insert(item)` per item | Data generation, tree construction |
| Spatial search | A batch of `Search(envelope)` calls | Tree construction and query generation |
| Linear baseline | The same query batch scanning every item and collecting matches | Data generation and query generation |
| Nearest neighbors | A batch of `Knn(10, x, y, maxDistance, predicate)` calls | Tree construction and query generation |
| Deletion | Delete a deterministic dispersed subset | Building a fresh tree for each sample |

Spatial batches contain 100 queries by default. Half are anchored on an item;
half can fall anywhere in the unit square. Query widths cycle through 0.005,
0.025, and 0.1 units. Rectangles have independently generated widths and heights
between 0.0001 and 0.008 units. Clustered data use five centers with triangular-like
local noise (the sum of three uniform random variables), rather than a claim of
normally distributed input. The console includes the actual average hits per
query so query selectivity remains visible.

Nearest-neighbor batches contain 12 queries by default. They alternate between
unbounded queries, a maximum distance of 0.1, and a predicate accepting even item
IDs. Each requests up to 10 results. Deletion removes 10% of the dataset, capped
at 1,000 items; the table reports the exact count. Search and nearest measurements
use a tree built by bulk loading. The insertion measurement includes the entire
construction workload but does not measure searches on that separately shaped
tree.

Both spatial implementations allocate result arrays, and their result lengths
contribute to a checksum. The displayed `scan/search` ratio is the measured
linear-batch median divided by the measured indexed-batch median for that exact
workload. It is not a general speedup guarantee.

## Correctness checks

Before timing a dataset, the benchmark compares every spatial query on both a
bulk-loaded tree and an individually populated tree with an independently
implemented inclusive rectangle-intersection scan. It compares sorted item IDs,
so missing results, additional results, and duplicate results fail the run.

Nearest results are checked against an independent point-to-rectangle distance
calculation and complete distance sort. Checks cover cardinality, membership,
unique objects, ascending distances, predicate eligibility, and the distance
limit. Equal-distance objects can have different identities in this performance
oracle; upstream compatibility tests establish the API's ordering behavior.

All insertion and bulk-load samples check `Count`. Every deletion sample checks
the successful deletion count, the resulting count, all remaining identities,
and rejection of a repeated deletion. These assertions and all workload setup
execute outside the timed intervals. They complement the test suite and are not
a substitute for it.

## Interpreting results

Run benchmarks without simultaneous builds, browser tests, or other CPU-intensive
jobs. Use multiple complete runs when judging a change; JIT compilation,
garbage collection, CPU frequency changes, virtualization, and competing host
workloads can affect medians. Warmup reduces some JIT effects but cannot guarantee
a fully steady runtime. The benchmark does not force garbage collection, so
allocation and collection costs can appear in measured operations. Setup allocations
may also trigger later collections during a timed interval.

R-trees benefit from selective spatial queries. Large result sets, strongly
overlapping rectangles, repeated identical boxes, and adversarial layouts can
reduce pruning and make a scan competitive. Returning many matches necessarily
requires time and memory proportional to the result size. Change the generator
or add your own application-shaped workload when its geometry differs materially
from these four cases.

These are Node/V8 measurements. They do not establish browser latency, Web Worker
message cost, rendering throughput, memory ceilings, .NET performance, or
performance against a different R-tree implementation. This repository makes no
cross-runtime performance claim from this harness. The interactive sample's
rendering time is separate from spatial-index execution time.

## Recorded initial-release observation

The complete raw measurement is in [benchmarks/node24.json](benchmarks/node24.json).
It records Node 24.19.0/V8 13.6 on the reported Linux/AMD EPYC host, five measured
samples after two warmups, and the seeded workload described above. These are
observations from this environment, not a latency guarantee.

| 100,000 items | Bulk load, ms | Individual inserts, ms | 100 indexed queries, ms | 100 linear queries, ms | 12 nearest queries, ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Uniform points | 311.077 | 290.005 | 11.009 | 92.595 | 0.319 |
| Uniform rectangles | 322.644 | 282.073 | 8.470 | 95.543 | 0.320 |
| Clustered points | 319.786 | 288.913 | 26.709 | 55.684 | 0.550 |
| Clustered rectangles | 315.486 | 278.200 | 36.193 | 59.061 | 0.756 |

Bulk loading preserves the upstream stable packing algorithm and caches sort
coordinates. Individual insertion happened to be faster for these particular
100k construction workloads; bulk loading is not claimed to win universally.
The nearest implementation prunes ordered envelopes using a min-heap. Inverted
item envelopes use the upstream full stable scan/sort to preserve their unusual
distance semantics. Split evaluation uses prefix/suffix bounds to avoid repeated
range scans.
