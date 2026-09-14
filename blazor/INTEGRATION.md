# Hosting and interop contract

Use interactive WebAssembly or Interactive Server. Static SSR renders only loading/host content. Wait for `Ready` before constructing native resources. Assets resolve relative to the app base URI under `_content/RBushWeb.Blazor/`; do not share browser sessions across Server users.

`SpatialQuery` uses ordinary Razor fragments. Optional native factories use uniquely identified `BrowserTemplate<TItem>` and `BrowserFunction.RazorTemplate`. Register `builder.Services.AddRBushWebBlazor()` and `builder.RootComponents.RegisterRBushWebBlazor()` for WASM; Server uses `AddRazorComponents().AddInteractiveServerComponents(options => options.RootComponents.RegisterRBushWebBlazor())`. Native roots support nested components, callbacks and shadow-DOM input binding but do not inherit outer cascading values automatically. Declare required `CascadingValue` components inside templates; durable state belongs outside recreated roots.

`BrowserModule` exposes constructor/invoke/call/get/set/events. Native functions returned by APIs use `InvokeReferenceAsync`, `CallReferenceAsync`, `GetReferenceAsync` and `CallFunctionAsync`, or pass their handle into another native operation. Synchronous spatial predicates and engine selectors remain browser callbacks; asynchronous `BrowserFunction.DotNet` only works where native APIs accept promises. Canceling an interop wait does not preempt synchronous native algorithms.

Complete DTO reads use `CallJsonAsync`, `InvokeJsonAsync`, `GetJsonAsync` and binary equivalents with a default explicit 64 MiB limit. `SubscribeJsonAsync` transfers full DTO notifications; `SubscribeAsync` is a bounded diagnostic snapshot of native graphs, not a model serializer. Batches are ordered, not atomic. Use `BrowserValue.Literal` for application arguments in generic interop, so reserved-looking `$fn` keys are not executed; never accept untrusted module URLs as callbacks.

Dispose owned indexes/modules asynchronously. Dispose borrowed JS handles without destroying native owners; use `ReleaseAsync` for resources you own. JSON is copied while JS handles retain identity. Use stable spatial item IDs for typed updates/deletion.

Source builds need recursive submodule initialization, npm ci/build and `node blazor/build.mjs`; NuGet consumers require neither Node nor Dockyard. CI restores the produced nupkg into net8.0/net10.0 WASM and Server samples at non-root paths. Tests check spatial correctness, atomic snapshots, full streams, native function handles, Razor callbacks and remounting. Chromium tests do not qualify every browser or hybrid WebView.

NuGet versioning is independent of npm in `Version.props`. Version-changing main merges publish after validation using `NUGET_API_KEY` (`NUGET_TOKEN`/`NUGET_KEY` aliases), reject conflicting immutable versions, verify downloaded public payloads and attach packages, symbols, samples and checksums to `blazor-v*` releases.
