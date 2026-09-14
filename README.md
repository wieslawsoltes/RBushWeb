# RBushWeb

A reusable R-tree spatial index for JavaScript, TypeScript and Blazor.

[![npm](https://img.shields.io/npm/v/%40wieslawsoltes%2Frbushweb)](https://www.npmjs.com/package/@wieslawsoltes/rbushweb)
[![npm downloads](https://img.shields.io/npm/dm/%40wieslawsoltes%2Frbushweb)](https://www.npmjs.com/package/@wieslawsoltes/rbushweb)
[![RBushWeb.Blazor on NuGet](https://img.shields.io/nuget/v/RBushWeb.Blazor?label=RBushWeb.Blazor&logo=nuget)](https://www.nuget.org/packages/RBushWeb.Blazor)
[![NuGet downloads](https://img.shields.io/nuget/dt/RBushWeb.Blazor)](https://www.nuget.org/packages/RBushWeb.Blazor)
[![Blazor CI](https://github.com/wieslawsoltes/RBushWeb/actions/workflows/blazor.yml/badge.svg)](https://github.com/wieslawsoltes/RBushWeb/actions/workflows/blazor.yml)

## JavaScript

```sh
npm install @wieslawsoltes/rbushweb
```

The [complete JavaScript guide](README.web.md) preserves API examples, architecture, benchmarks/tests, compatibility and license notices. [Open Spatial Lab](https://wieslawsoltes.github.io/RBushWeb/).

## Blazor

```sh
dotnet add package RBushWeb.Blazor --version 0.2.2
```

The .NET 8/.NET 10 package wraps the real browser R-tree, with `SpatialIndex<T>`, stable string identities, bulk operations, intersection and nearest-neighbor queries, snapshots, `SpatialProvider` and Razor-templated `SpatialQuery<TItem>`. JavaScript assets are local; NuGet consumers need neither npm nor a CDN.

Read the [Blazor guide](blazor/README.md), [integration contract](blazor/INTEGRATION.md), [working sample](blazor/sample/Demo.razor) and [release notes](blazor/RELEASE.md).

```sh
git submodule update --init --recursive
npm ci
npm run build
node blazor/build.mjs
dotnet run --project blazor/sample/Sample.csproj
# Or: dotnet run --project blazor/server/Server.csproj
```

Source builds require the .NET 10 SDK with .NET 8 targeting support. The Server sample uses `/probe/`. CI tests actual nupkg consumers across both hosts/frameworks, native spatial operations, snapshot integrity, streaming, templates and remounting.

NuGet is independently versioned in `blazor/Version.props`. Version-changing main merges publish after validation using `NUGET_API_KEY` (`NUGET_TOKEN`/`NUGET_KEY` aliases), verify the public package payload, and create `blazor-v*` releases with symbols, samples and checksums. Native-engine/browser boundaries remain applicable. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
