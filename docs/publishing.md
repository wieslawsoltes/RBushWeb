# Publishing and release verification

RBushWeb publishes as [`@wieslawsoltes/rbushweb`](https://www.npmjs.com/package/@wieslawsoltes/rbushweb). The initial version is `0.1.0`. The package contains ESM, CommonJS, TypeScript declarations, and a standalone browser bundle, with no runtime dependencies.

## Automatic releases from main

The [CI and distribution workflow](../.github/workflows/ci.yml) runs on pushes to `main`, pull requests, and manual dispatch. A successful main-branch run automatically creates a release and publishes a previously unpublished package version. There is no separate publication approval step in the workflow. Any protection rules configured independently on the GitHub `npm` environment still apply.

For subsequent releases:

1. Update `package.json` and `package-lock.json` to a new version, for example with `npm version patch --no-git-tag-version`.
2. Update `CHANGELOG.md` and `docs/release-notes.md` for that version.
3. Commit and push the changes to `main` through the normal repository contribution process.
4. Check the CI run, its npm verification summary, and the versioned GitHub release.

The workflow performs these steps before publication:

1. Run `npm ci` and `npm run check` on Node.js 22 and 24. The check script builds the library, checks TypeScript usage, runs the test suite, and builds the showcase.
2. Test installed package consumers with `npm run test:package`, install Chromium through Playwright, and run `npm run test:browser` on both Node versions. Record benchmark observations on Node 24 as a downloadable JSON artifact.
3. Build a fresh distribution and package it with `npm pack --ignore-scripts`. Create standalone browser and showcase archives, then compute SHA256 checksums.
4. Create a GitHub release named `v<package version>` that targets the exact commit verified by CI. Existing releases and their assets are retained.
5. Confirm that the release tag resolves to the same commit as this CI run. A later main-branch commit with an unchanged package version does not republish the older release.
6. Call the reusable npm publication workflow with the release tag, the verified commit SHA, and the `latest` distribution tag.

Pull requests run verification only. Main-branch CI runs are not canceled by a newer push while release work is underway.

## Credentials and provenance

The repository's existing `NPM_TOKEN` Actions secret supplies npm authentication. Its value is passed as `NODE_AUTH_TOKEN` only to the publication step; it is never printed or written into committed files. The token must allow publication of `@wieslawsoltes/rbushweb`. When npm trusted publishing has been configured for this repository and workflow, the optional token can be omitted.

The reusable workflow uses the GitHub `npm` environment and grants `id-token: write` for provenance. Publication runs on GitHub Actions with Node.js 24 and npm 11:

```sh
npm publish "$RELEASE_TARBALL" \
  --registry=https://registry.npmjs.org \
  --access public \
  --provenance \
  --ignore-scripts \
  --tag "$NPM_DIST_TAG"
```

The workflow publishes the downloaded release artifact. It does not rebuild the package immediately before publishing it. Never paste a token into a workflow input, issue, command example, or diagnostic output; inspect the Actions secret configuration and publication error without exposing the secret value.

## Immutable artifacts and public verification

Each release includes:

| Asset | Contents |
| --- | --- |
| `wieslawsoltes-rbushweb-<version>.tgz` | npm package produced by the verified build |
| `rbushweb-browser.tar.gz` | Contents of the `dist/` directory |
| `rbushweb-showcase.tar.gz` | Contents of the deployable `site/` directory |
| `SHA256SUMS.txt` | SHA256 checksum for each archive |

The [registry verification script](../scripts/npm-registry.mjs) checks the release tarball against its SHA256 manifest entry and tests that exact tarball in installed consumers before querying npm. Only an unauthenticated HTTP 404 confirms that the package version is absent. Authentication failures, malformed responses, and unexpected registry errors do not authorize publication.

If the version already exists, its public metadata must match the package name, version, and release tarball's SHA512 integrity. A different artifact under the same version fails the workflow; npm versions are immutable, so a corrected build needs a new version.

After publishing or identifying identical existing bytes, the workflow waits for public registry propagation and verifies:

- The version endpoint and package install index both report the expected SHA512 integrity.
- The selected `latest` or `next` tag identifies the release version in both tag metadata and the install index.
- npm exposes provenance metadata for the version.
- The HTTPS tarball is hosted by `registry.npmjs.org`, contains no URL credentials, and downloads with the same SHA512 integrity as the release asset.
- Installed consumers pass against the downloaded public artifact.
- A new consumer directory, a fresh npm cache, and no npm publication token can install the package by its public name and version. The installed package must execute bulk loading, spatial search, nearest-neighbor search, and deletion correctly.

The provenance check verifies that npm exposes the provenance metadata. It does not independently implement certificate or transparency-log verification. Benchmark output records observations and does not assert a hardware-independent performance threshold.

## Retry an existing release

If publication or registry verification fails after the GitHub release has been created, use the [Publish npm registry workflow](https://github.com/wieslawsoltes/RBushWeb/actions/workflows/npm-publish.yml). Select **Run workflow** on `main` and provide:

| Input | Value |
| --- | --- |
| `tag` | An existing published GitHub release tag, such as `v0.1.0` |
| `expected_sha` | Optional full, lowercase, 40-character commit SHA that the tag must resolve to; supplying the verified release SHA provides an additional check |
| `dist_tag` | `latest` or `next`; defaults to `latest` |

The retry checks out the tag, verifies that it matches `package.json`, downloads the existing release assets, and repeats artifact and public registry verification. Draft releases are rejected. It does not overwrite release assets or rebuild them. A retry after a successful npm upload safely recognizes identical existing bytes and skips the upload.

An authenticated GitHub CLI can start the same workflow from a repository checkout that has the release tag:

```sh
release_sha=$(git rev-list -n 1 v0.1.0)
gh workflow run npm-publish.yml \
  --repo wieslawsoltes/RBushWeb \
  --ref main \
  -f tag=v0.1.0 \
  -f expected_sha="$release_sha" \
  -f dist_tag=latest
```

Use the intended release tag in both commands when retrying a different version.

### Distribution-tag behavior

Automatic main-branch publication always uses `latest`, including versions with a prerelease suffix. It does not infer `next` from a prerelease version. Adjust the automatic workflow before introducing a prerelease release policy that requires `next`.

The manual `dist_tag` input controls the tag used when publishing an absent version and the tag checked during verification. It does not move tags on already published versions. Retrying an old version after `latest` has advanced, or selecting `next` for an existing version that is only tagged `latest`, therefore fails tag verification even when the artifact bytes match. Use the tag that already identifies the intended version, or deliberately update the registry tag as a separate maintainer action. Do not move `latest` backward merely to make an old verification run pass.

## Optional GitHub Pages showcase

The [Deploy showcase workflow](../.github/workflows/pages.yml) is separate from CI and npm publication and runs only by manual dispatch on `main`. Configure the repository's Pages source as **GitHub Actions**, then run **Deploy showcase**. It builds the library and `site/`, uploads a Pages artifact, and deploys to the `github-pages` environment.

Repository Pages permissions and any environment protection rules must permit deployment. A Pages configuration or deployment failure does not block npm publication. The release's `rbushweb-showcase.tar.gz` can also be extracted and served by any static HTTP server; deployment does not require an application backend.

## Local verification

Use Node.js 22 or newer:

```sh
npm ci
npm run check
npm run test:package
npx playwright install --with-deps chromium
npm run test:browser
npm run benchmark
```

To verify a downloaded release tarball using the repository's consumer checks:

```sh
node scripts/package-test.mjs --tarball /absolute/path/to/wieslawsoltes-rbushweb-0.1.0.tgz
```

Local checks prepare and inspect artifacts; the configured GitHub Actions workflow performs the authenticated npm publication and provenance generation.
