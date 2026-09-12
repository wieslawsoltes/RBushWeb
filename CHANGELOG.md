# Changelog

## 0.1.0

Initial JavaScript port of viceroypenguin/RBush at commit 101b6fb915215d9d30294a1178fe09ebd6929d73.

- Ported the public spatial index, database, envelope, node, and nearest-neighbor APIs.
- Preserved all upstream tests and numeric fixtures, with additional independent correctness tests.
- Added plain-object adapters, lowercase aliases, collision queries, diagnostics, and JSON round trips.
- Added ESM, CommonJS, a standalone browser bundle, and TypeScript declarations.
- Added the interactive Spatial Lab and reproducible performance benchmarks.
- Added verified, immutable npm release publishing with provenance and public-registry consumer checks.
