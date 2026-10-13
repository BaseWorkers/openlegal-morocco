# npm release process

OpenLegal publishes from the public repository's `main` branch after a successful `Foundation CI` run. The workflow uses npm Trusted Publishing through GitHub Actions OIDC; it does not store a long-lived npm write token.

## Configure npm Trusted Publishing

For the package `openlegal`, add a GitHub Actions trusted publisher with:

- Owner: `BaseWorkers`
- Repository: `openlegal-morocco`
- Workflow filename: `npm-publish.yml`
- Allowed action: direct `npm publish`

The workflow uses Node.js 24 and npm 11.5.1 or later. npm requires the first successful trusted publish within two days of creating the trust configuration, so set it up immediately before enabling the workflow and publishing a new version.

## Release a version

1. Update `version` in `package.json` to a version that has never been published.
2. Commit the change and merge it to `main`.
3. Wait for `Foundation CI` to pass. The publish workflow proceeds only if that successful run tested the current `main` commit; stale runs are skipped.
4. The workflow checks npm and skips a version that already exists.
5. Stable versions publish to the `latest` tag. Versions containing a prerelease suffix (for example, `0.2.0-next.1`) publish to `next`.
6. Verify the result with `npm view openlegal dist-tags --json` and install the intended tag in a clean directory before announcing the release.

npm versions are immutable: a published name/version pair cannot be published again. Bump `package.json` for every new release. A failed registry lookup stops the workflow rather than treating the version as unpublished.

## Scope

Publishing the package does not change template review states. Legal templates remain `DRAFT` until qualified, independent review evidence is recorded and authorized. The scanner reports technical indicators; it does not give legal advice or certify compliance.
