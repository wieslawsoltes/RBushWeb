# Upstream test parity

Source: [viceroypenguin/RBush](https://github.com/viceroypenguin/RBush/tree/101b6fb915215d9d30294a1178fe09ebd6929d73), pinned revision `101b6fb915215d9d30294a1178fe09ebd6929d73`.

All **28 upstream test methods** are ported: 22 in `RBushTests.cs` and six in `KnnTests.cs`. Each upstream method is an individual named `node:test` test with the original class and method name. The upstream revision uses `[Test]` attributes; it contains no parameterized theory/data-row cases. No upstream method is skipped. The ports retain the original assertions, including root height/child count, ordered KNN comparisons, set equality, exact count, and the missing-envelope regressions.

| Upstream test method | Executable JS port | Cases |
| --- | --- | ---: |
| `RBushTests.RootLeafSplitWorks` | [`upstream-rbush.test.js`](../test/upstream-rbush.test.js) | 1 |
| `RBushTests.InsertTestData` | [`upstream-rbush.test.js`](../test/upstream-rbush.test.js) | 1 |
| `RBushTests.BulkLoadTestData` | [`upstream-rbush.test.js`](../test/upstream-rbush.test.js) | 1 |
| `RBushTests.BulkLoadSplitsTreeProperly` | [`upstream-rbush.test.js`](../test/upstream-rbush.test.js) | 1 |
| `RBushTests.BulkLoadMergesTreesProperly` | [`upstream-rbush.test.js`](../test/upstream-rbush.test.js) | 1 |
| `RBushTests.SearchReturnsEmptyResultIfNothingFound` | [`upstream-rbush.test.js`](../test/upstream-rbush.test.js) | 1 |
| `RBushTests.SearchReturnsMatchingResults` | [`upstream-rbush.test.js`](../test/upstream-rbush.test.js) | 1 |
| `RBushTests.BasicRemoveTest` | [`upstream-rbush.test.js`](../test/upstream-rbush.test.js) | 1 |
| `RBushTests.NonExistentItemCanBeDeleted` | [`upstream-rbush.test.js`](../test/upstream-rbush.test.js) | 1 |
| `RBushTests.DeleteTreeIsEmptyShouldNotThrow` | [`upstream-rbush.test.js`](../test/upstream-rbush.test.js) | 1 |
| `RBushTests.DeleteDeletingLastPointShouldNotThrow` | [`upstream-rbush.test.js`](../test/upstream-rbush.test.js) | 1 |
| `RBushTests.ClearWorks` | [`upstream-rbush.test.js`](../test/upstream-rbush.test.js) | 1 |
| `RBushTests.TestSearchAfterInsert` | [`upstream-rbush.test.js`](../test/upstream-rbush.test.js) | 1 |
| `RBushTests.TestSearchAfterInsertWithSplitRoot` | [`upstream-rbush.test.js`](../test/upstream-rbush.test.js) | 1 |
| `RBushTests.TestSearchAfterBulkLoadWithSplitRoot` | [`upstream-rbush.test.js`](../test/upstream-rbush.test.js) | 1 |
| `RBushTests.AdditionalRemoveTest` | [`upstream-rbush.test.js`](../test/upstream-rbush.test.js) | 1 |
| `RBushTests.BulkLoadAfterDeleteTest1` | [`upstream-rbush.test.js`](../test/upstream-rbush.test.js) | 1 |
| `RBushTests.BulkLoadAfterDeleteTest2` | [`upstream-rbush.test.js`](../test/upstream-rbush.test.js) | 1 |
| `RBushTests.InsertAfterDeleteTest1` | [`upstream-rbush.test.js`](../test/upstream-rbush.test.js) | 1 |
| `RBushTests.InsertAfterDeleteTest2` | [`upstream-rbush.test.js`](../test/upstream-rbush.test.js) | 1 |
| `RBushTests.MissingEnvelopeTestInsertIndividually` | [`upstream-rbush.test.js`](../test/upstream-rbush.test.js) | 1 |
| `RBushTests.TestBulk` | [`upstream-rbush.test.js`](../test/upstream-rbush.test.js) | 1 |
| `KnnTests.FindsNNeighbors` | [`upstream-knn.test.js`](../test/upstream-knn.test.js) | 1 |
| `KnnTests.DoesNotThrowIfRequestingTooManyItems` | [`upstream-knn.test.js`](../test/upstream-knn.test.js) | 1 |
| `KnnTests.FindAllNeighborsForMaxDistance` | [`upstream-knn.test.js`](../test/upstream-knn.test.js) | 1 |
| `KnnTests.FindNNeighborsForMaxDistance` | [`upstream-knn.test.js`](../test/upstream-knn.test.js) | 1 |
| `KnnTests.DoesNotThrowIfRequestingTooManyItemsForMaxDistance` | [`upstream-knn.test.js`](../test/upstream-knn.test.js) | 1 |
| `KnnTests.FindNeighborsThatSatisfyAGivenPredicate` | [`upstream-knn.test.js`](../test/upstream-knn.test.js) | 1 |

## Fixtures and language adaptation

[`test/fixtures.js`](../test/fixtures.js) retains every coordinate as the exact decimal literal in the upstream source: 48 tree points, 100 KNN rectangles, six rich-data points, and 94 missing-envelope rectangles. Original C# files are retained under [`test/upstream`](../test/upstream) for traceability. [`test/parity-audit.test.js`](../test/parity-audit.test.js) verifies fixture arrays numerically against the copied C# source and checks this manifest covers every upstream test method.

`Point.cs` becomes the `Point` helper in [`test/helpers.js`](../test/helpers.js). Its value equality compares envelopes, matching upstream `IEquatable<Point>`. C# `HashSet<Point>.SetEquals` becomes a comparison of sets of envelope coordinate tuples. Ordered `Assert.Equal` comparisons retain ordered coordinate tuples. `IReadOnlyList.Count` becomes JavaScript array `length`. C# `OrderBy` becomes a stable array sort; generator inputs exercise the enumerable adaptation. Named optional arguments map to their positional JavaScript equivalents. No source fixture is synthesized or rounded.

## Additional independent verification

[`test/differential.test.js`](../test/differential.test.js) adds seeded mixed-operation scenarios for node capacities 4, 5, 9, 16, and 32 (500 mutations each). Every step checks count, exact stored identities, maximum node occupancy, balanced heights, descendant bounds, unbounded traversal, and rectangle searches against an independent scalar brute-force oracle. Periodic nearest-neighbor queries compare against independent rectangle distance and sorting.

Further cases cover corner-touching/zero-area geometry, every fixture rectangle corner, distance ties across multiple internal nodes, k=0 and negative k, exact radius inclusion, filters applied before k truncation, custom spatial-index implementations, all equality forms, equal duplicates across leaves, deletion to empty and reuse, iterable consumption, caller-array preservation, independent search result arrays, explicit move by delete/mutate/insert, envelope operations/sentinels, and minimum constructor capacity.

[`test/web-extras.test.js`](../test/web-extras.test.js) covers JavaScript-specific contracts: collision queries; every public alias; immutable envelope values and live read-only node views; iteration; statistics and stale-bound validation; plain and wrapped bounding boxes; custom accessors and equality; JSON snapshots with custom class serializers; atomic malformed-input rejection, including empty internal nodes; empty/infinite bounds encoding; invalid coordinates and arguments; and a 100,000-item grid range/search/restore check. Its mixed inverted, empty, and infinite envelope KNN regression compares stable upstream distance ordering before and after import and deletion.

These tests establish executable behavioral coverage for the pinned upstream test suite and the additional tested scenarios. They do not constitute exhaustive mathematical proof for all floating-point inputs or a comparison of .NET internal sort layouts on equal coordinates.
