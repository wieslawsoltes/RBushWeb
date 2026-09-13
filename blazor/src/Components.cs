using System.Text.Json;
using Microsoft.JSInterop;
namespace RBushWeb.Blazor;

public sealed record Envelope(double MinX, double MinY, double MaxX, double MaxY);
public sealed record SpatialItem<T>(string Id, Envelope Envelope, T Value);
public sealed record SpatialStatistics(int Count, int Height, int NodeCount, int LeafCount, int EmptyLeafCount, int MaxEntries, double FillRatio);
public sealed class SpatialProvider : BrowserProvider { }
public sealed class RBushModule(IJSRuntime js) : BrowserModule(js)
{
    public ValueTask<SpatialIndex<T>> CreateIndexAsync<T>(int maxEntries = 9) => SpatialIndex<T>.CreateAsync(this, maxEntries);
}
/// <summary>A typed, stable-key facade over the real browser R-tree; all algorithms execute in RBushWeb.</summary>
public sealed class SpatialIndex<T> : IAsyncDisposable
{
    public BrowserModule Module { get; }
    public IJSObjectReference Handle { get; }
    private int _disposed;
    private SpatialIndex(BrowserModule module, IJSObjectReference handle) { Module = module; Handle = handle; }
    public static async ValueTask<SpatialIndex<T>> CreateAsync(BrowserModule module, int maxEntries = 9) => new(module, await module.CreateAsync("BlazorSpatialIndex", [maxEntries]));
    public ValueTask<int> GetCountAsync() => Module.GetAsync<int>(Handle, "Count");
    public ValueTask InsertAsync(SpatialItem<T> item) => Module.CallVoidAsync(Handle, "Insert", [item]);
    public ValueTask UpsertAsync(SpatialItem<T> item) => Module.CallVoidAsync(Handle, "Upsert", [item]);
    public ValueTask BulkLoadAsync(IEnumerable<SpatialItem<T>> items, bool replace = false) => Module.CallVoidAsync(Handle, "BulkLoad", [items, replace]);
    public ValueTask<bool> DeleteAsync(string id) => Module.CallAsync<bool>(Handle, "Delete", [id]);
    public ValueTask<SpatialItem<T>[]> SearchAsync(Envelope? bounds = null) => Module.CallAsync<SpatialItem<T>[]>(Handle, "Search", [bounds]);
    public ValueTask<bool> CollidesAsync(Envelope bounds) => Module.CallAsync<bool>(Handle, "Collides", [bounds]);
    public ValueTask<SpatialItem<T>[]> KnnAsync(int count, double x, double y, double? maxDistance = null, object? predicate = null) => Module.CallAsync<SpatialItem<T>[]>(Handle, "Knn", [count, x, y, maxDistance, predicate]);
    public ValueTask<SpatialStatistics> GetStatsAsync() => Module.CallAsync<SpatialStatistics>(Handle, "GetStats");
    public ValueTask ValidateAsync() => Module.CallVoidAsync(Handle, "Validate");
    public ValueTask ClearAsync() => Module.CallVoidAsync(Handle, "Clear");
    public ValueTask<string> ExportAsync() => Module.CallAsync<string>(Handle, "Export");
    public ValueTask ImportAsync(string snapshot) => Module.CallVoidAsync(Handle, "Import", [snapshot]);
    public async ValueTask DisposeAsync()
    {
        if (Interlocked.Exchange(ref _disposed, 1) != 0) return;
        try { await Module.ReleaseAsync(Handle); }
        catch (ObjectDisposedException) { await Handle.DisposeAsync(); }
        catch (JSDisconnectedException) { }
    }
}
