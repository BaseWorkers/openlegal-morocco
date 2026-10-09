# Static multilingual catalog preview

The repository generates a static, read-only catalog from the same template packages, source registry, and recorded review metadata used by the CLI and MCP server. The implementation uses plain HTML, CSS, and a small local search script; it adds no runtime or commercial dependency and sends no search query to a third party.

## Build and preview

```sh
npm run build:site
python3 -m http.server 8000 --directory dist/site
```

Open `http://localhost:8000/`. The language landing page links to `/en/`, `/fr/`, and `/ar/`; each template has a detail route under its language. Arabic pages declare RTL direction. Every catalog and detail page displays draft status, source declarations and verification state, language review state, license, and version. Source-file links point to an exact commit when `GITHUB_SHA` is set to a commit ID.

The build emits `robots.txt` by default. A public canonical base URL must be confirmed by the project owner before publishing. Until then, canonical URLs and `sitemap.xml` are omitted rather than using a placeholder domain. For a deployment preview with an approved base URL, run `npm run build:site -- --base-url https://your-approved-domain.example`; the build validates HTTPS and emits canonical links and an absolute sitemap. This only generates local files and does not deploy them.

## Design and access

The catalog uses an editorial list so users can scan document type, available languages, and version without opening each draft. Search and category filtering run locally. All controls have visible labels, keyboard focus, reduced-motion support, responsive layouts, semantic headings, RTL-aware spacing, and a visible draft warning. Generated Markdown is escaped and rendered through the repository's safe renderer; source URLs are linked only when they use HTTPS.

Automated accessibility checks cover Markdown source conventions, while manual keyboard, screen-reader, and mobile review remain release tasks. The site is a build artifact, not a hosted service or claim of full WCAG 2.2 AA conformance.
