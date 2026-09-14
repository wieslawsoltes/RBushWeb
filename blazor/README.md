# RBushWeb.Blazor

Install `RBushWeb.Blazor` 0.2.1 for .NET 8/.NET 10. The native R-tree browser engine is included as local static assets for interactive WebAssembly and Server.

## Typed spatial services

After `SpatialProvider.Ready`, call `SpatialIndex<T>.CreateAsync(module)`, then insert/upsert `SpatialItem<T>` values with unique string IDs and finite ordered `Envelope` bounds. Stable IDs retain native references for identity-safe deletion across C# DTO round trips.

The service supports bulk loading, replacement, intersection search, collision checks, KNN with optional distance/predicate, statistics, validation, clear and snapshots. Search/KNN/snapshot results use complete streamed JSON. Snapshot import validates before replacing the current index and restores the saved branching configuration. Invalid or duplicate input does not partially replace an index.

```razor
<SpatialQuery TItem="string" Index="index" Bounds="bounds" Revision="revision">
    <ChildContent Context="items">
        @foreach (var item in items) { <p @key="item.Id">@item.Value</p> }
    </ChildContent>
</SpatialQuery>
```

Increment `Revision` after mutating the index so a query component refreshes. Query results are DTO copies; edits must be committed through the service. The [sample](sample/Demo.razor) validates native queries against brute force, nearest-neighbor identity, deletion and snapshot restore.

Full native APIs are available through `Module`/`Handle`, including returned function references and synchronous browser callback descriptors. Read [INTEGRATION.md](INTEGRATION.md) for hosting, ownership and publishing. Typed helpers complement native API access; underlying engine compatibility limits still apply.
