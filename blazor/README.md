# RBushWeb.Blazor

A self-contained .NET 8 / .NET 10 Razor Class Library wrapping the real RBushWeb spatial engine. It contains typed spatial services, lifecycle/provider components, templated query rendering, native JavaScript exports, documentation and licenses.

```sh
dotnet add package RBushWeb.Blazor --version 0.2.0
```

## Typed spatial API

```csharp
// Initialize from an interactive component's Ready/OnAfterRenderAsync.
await using var module = new RBushModule(JS);
await using var index = await module.CreateIndexAsync<string>();
await index.InsertAsync(new SpatialItem<string>("one", new Envelope(0, 0, 10, 10), "First rectangle"));
var matches = await index.SearchAsync(new Envelope(5, 5, 20, 20));
var nearest = await index.KnnAsync(1, 20, 20);
await index.DeleteAsync("one");
```

`SpatialIndex<T>` supports insertion, upsert, atomic batch replacement/bulk loading, stable-id deletion, all/bounded search, collision tests, nearest neighbors, statistics, structural validation, clear and JSON snapshots. All indexing and query algorithms run in the native RBush engine, not a C# linear-search substitute. Stable ids preserve native object identity when .NET DTOs are serialized again. Bounds in the typed facade must be finite and ordered; the raw native API remains available for specialized infinite/inverted-envelope semantics.

The typed index requires unique nonempty string ids. Bulk loading validates the whole batch and builds a replacement native tree before swapping it, so malformed or duplicate input cannot partially replace the existing index. `ImportAsync` restores versioned item snapshots into the current index; these snapshots do not serialize arbitrary functions or CLR type identity. Retain modules/indexes for the lifetime of the consuming component; dispose them when the component goes away.

## Blazor components

`SpatialProvider` initializes and owns a browser session after interactive rendering and passes it to `Ready` and a `RenderFragment<BrowserModule>` child context. `SpatialQuery<TItem>` renders an application's own `RenderFragment<IReadOnlyList<SpatialItem<TItem>>>` for a supplied index and bounds. Change `Bounds` or increment `Revision` after index mutations to rerun the query. Stale asynchronous query results are discarded. The query component does not own its supplied index. The sample uses this component to render an accessible SVG visualization entirely from Razor.

## Native API and callbacks

`RBushModule` inherits `BrowserModule`: `GetExportsAsync`, `CreateAsync`, `InvokeAsync`, `CallAsync`, `GetAsync`, `SetAsync`, `SubscribeAsync`, and `ReleaseAsync` expose the complete bundled JavaScript API, including native RBush, Envelope, Node and extension functions. Use `IJSObjectReference` for native objects, maintaining their identity; use DTOs/JsonElement for value data. The generic bridge is not an exhaustive strongly typed C# port of every native member.

`BrowserFunction.Property`, `Setter`, `Constant`, and `Module("./predicates.js", "accept")` create synchronous native callbacks without eval. Use module callbacks for specialized comparers, envelope selectors or nearest-neighbor predicates. `BrowserFunction.DotNet` is asynchronous and cannot serve as a synchronous comparer/predicate on Blazor Server. Cancellation of an interop wait does not terminate a JavaScript algorithm already executing.

`CreateAsync` results are session-owned. Disposing a module removes its resources and callbacks; disposing an `IJSObjectReference` only releases the interop handle, while `ReleaseAsync` invokes native disposal too. Use per-component/per-circuit modules, not Server application singletons. Static prerender does not call JavaScript; interactive WebAssembly and Server are supported. Static assets resolve through the application's base URI under `_content/RBushWeb.Blazor`, with no npm/CDN requirement for package consumers.

## Source builds, samples and qualification

```sh
git submodule update --init --recursive
npm ci
npm run build
node blazor/build.mjs
dotnet run --project blazor/sample/Sample.csproj
dotnet run --project blazor/server/Server.csproj --urls http://localhost:5080
# Server sample: http://localhost:5080/probe/
```

The common bridge, project/host boilerplates and test harness are generated from the commit-pinned `blazor/runtime-source` source submodule. Project-specific adapters, typed services, query component and sample are reviewed source here. The resulting NuGet package is independent of Dockyard and contains all required browser code locally. Generated files are ignored and recreated by the build.

CI packs both frameworks, verifies nupkg contents, runs JavaScript bridge and managed lifecycle/prerender checks, restores both sample hosts from the actual package and drives them in Chromium. The native spatial query is compared with brute-force expected results, then nearest-neighbor, deletion, snapshot restoration, structural validation and repeated unmount/remount are checked. Artifacts include packages, runnable sample and diagnostic screenshots. This does not assert qualification of every browser/device.

`blazor/Version.props` versions NuGet independently of npm. A validated version-changing PR merged to main publishes using `NUGET_API_KEY` (fallback `NUGET_TOKEN` or `NUGET_KEY`) and creates a `blazor-v<version>` release with packages and the published WebAssembly sample. Manual workflow dispatch defaults to validation-only. Update the runtime submodule and reusable workflow SHA together through reviewed PRs.
