# RBushWeb 0.1.0

The first JavaScript release of the viceroypenguin/RBush API port, including the reusable spatial-index library, generic TypeScript declarations, original upstream tests and fixtures, independent correctness tests, and interactive Spatial Lab.

Install with `npm install @wieslawsoltes/rbushweb`.

Use the npm tarball for the complete package, `rbushweb-browser.tar.gz` for standalone ESM/CommonJS/browser bundles, and `rbushweb-showcase.tar.gz` for the self-contained HTML/JavaScript sample. Artifact checksums are recorded in `SHA256SUMS.txt`.

The API includes tree insertion, bulk loading, range search, deletion with custom equality, nearest-neighbor queries with radius/predicate filters, immutable envelope operations, and public node inspection. JavaScript additions include plain-object adapters, collision queries, diagnostics, and validated tree serialization. See `docs/api.md` for C# language adaptations and serialization requirements.

CI verifies the library, installed package consumers, strict TypeScript module consumers, and browser interactions before creating the release. npm publishing reuses the exact checked release tarball and verifies its public registry integrity and provenance afterward.
