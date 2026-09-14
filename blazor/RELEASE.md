# RBushWeb.Blazor 0.2.0

- .NET 8/.NET 10 native R-tree wrapper, typed stable-ID services, provider and Razor query component.
- Full streamed query/KNN/snapshot results and safe literal DTO input.
- Snapshot import now restores the saved branching factor and validates atomically; regression tests cover invalid snapshots and duplicate input.
- Native function references, shared scoped templates and lifecycle support.
- Actual-package WebAssembly/Server samples and native-query/stream/template/remount validation.
- Root and Blazor documentation, independent NuGet publication, public payload verification and runnable release samples.

Native engine and hosting constraints remain applicable. Generic interop complements the typed API; synchronous engine callbacks execute in the browser.
