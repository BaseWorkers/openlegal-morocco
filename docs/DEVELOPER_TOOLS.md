# Local CLI and static API

These tools read the repository's local template packages and do not make network requests.

## CLI

Use Node.js 22 or later:

```sh
npm run cli -- list --language ar
npm run cli -- show privacy-policy --language fr
npm run cli -- sources privacy-policy
npm run cli -- status privacy-policy
npm run cli -- export privacy-policy --language en --format md
npm run cli -- check
```

`show`, `status`, and `sources` report recorded metadata and the discussion-draft disclaimer. `export` writes Markdown or JSON under ignored `dist/exports/`, refuses to overwrite a file, and includes a visible draft watermark, exact template version, language, repository ref, source IDs, and content digest. It does not fill variables or enable the approval-gated production generator.

## Static JSON API

Build deterministic read-only artifacts from the same local catalogue:

```sh
npm run build:api
```

The output is written under ignored `dist/api/v1/` and includes `manifest.json`, `templates.json`, `templates/{id}.json`, and `templates/{id}/sources.json`. Set `GITHUB_SHA` in a release build to bind provenance to that repository revision. Every response carries the recorded review state, `verified: false`, and a disclaimer; source references and draft states are not converted into legal conclusions. The repository does not host these files.

The artifacts are local build outputs. Hosting, public endpoints, and legal approval are separate decisions and are not implied by generating them.

See [Interoperability and structured findings](INTEROPERABILITY.md) for the versioned findings schema, vendor-neutral control taxonomy, CLI/MCP export and validation, privacy boundaries, and compatibility policy. The static API build publishes the v1 schema and taxonomy alongside catalogue artifacts.

## Static catalog preview

Build and serve the local multilingual read-only catalog with `npm run build:site` and `python3 -m http.server 8000 --directory dist/site`. See [the site build and publishing boundary](SITE.md) for language routes, accessibility scope, and owner-confirmed canonical URL requirements.
