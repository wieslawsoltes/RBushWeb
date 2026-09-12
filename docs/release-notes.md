# RBushWeb 0.1.1

This patch completes the first release with a Spatial Lab query-state correction. Inserting outside the current query window now updates the tree while preserving the saved query. Deletion, movement, clearing, generation, and import also refresh the saved query safely. Nearest-neighbor parameters remain independent of insertion coordinates, and mode switches restore valid rectangle bounds.

Browser regression coverage now exercises insertion beyond the previous maximum bounds, deletion, and a subsequent query. The reusable library API remains the same as 0.1.0.

Install with `npm install @wieslawsoltes/rbushweb`.

The npm tarball contains the complete library and demo source. `rbushweb-browser.tar.gz` contains standalone modules and `rbushweb-showcase.tar.gz` contains the self-contained HTML/JavaScript sample. `SHA256SUMS.txt` records checksums; npm publication uses the exact verified release tarball with provenance.
