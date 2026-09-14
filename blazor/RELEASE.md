# RBushWeb.Blazor 0.2.1

Updates the pinned shared runtime to tested Dockyard revision `1c895b7184451071e1c7131063249d2d9eb145b9`, retaining a self-contained NuGet package.

- Preserve cyclic/deep native arguments, shared callback identity and callable property/method/disposal access.
- Await concurrent native/module/subscription cleanup and asynchronous unsubscribe, continuing cleanup after individual failures.
- Honor initialization-wait cancellation independently for each caller and prevent late native work after disposal.
- Add `CallFunctionJsonAsync<T>` for complete streamed callable results and expanded JavaScript/managed regressions.

Typed stable-ID spatial services, bulk/intersection/KNN queries, snapshots and Razor provider/query components remain available. .NET 8/.NET 10 actual-package WebAssembly/Server tests validate native queries, snapshot integrity, streaming and Razor callbacks before publication. Downloaded public NuGet payloads are verified before release creation. Native engine/browser contracts are unchanged.
