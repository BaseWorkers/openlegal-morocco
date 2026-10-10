# Local CLI, MCP, and Codex plugin

OpenLegal includes local read-only tooling for source review and a Next.js privacy-evidence scan. The repository scan makes no network requests; optional URL mode contacts only the public HTTPS address that the user supplies. Neither mode changes review statuses or certifies compliance.

## Install the public CLI

Requires Node.js 22 or later. To add OpenLegal to a project and run the command with `npx`:

```sh
npm install openlegal
npx openlegal --version
npx openlegal check
npx openlegal list --language en
```

To install the command globally instead:

```sh
npm install --global openlegal
openlegal --version
openlegal check
```

Expected: `OpenLegal 0.1.0`, `valid: true`, and 14 template packages. These are discussion drafts and remain unreviewed. The package has no JavaScript runtime dependencies.

To run the MCP server from an installed package, configure a client to launch `openlegal-mcp`. For Codex CLI, use `codex mcp add openlegal -- openlegal-mcp`, then restart Codex if the server tools do not appear. Python 3.10 or later is required. Set `PYTHON` to the Python executable path if your system does not use `python3` (or `python` on Windows).

## Command-line interface

Node.js 22 or later is required; there are no runtime package dependencies. From the repository root, use the CLI to list drafts, inspect a package, read its declared sources or review status, and validate a supplied findings document:

```sh
npm run cli -- --version
npm run cli -- check
npm run cli -- list --language en
npm run cli -- show privacy-policy --language fr
npm run cli -- status privacy-policy
npm run cli -- sources privacy-policy
npm run cli -- findings validate findings.json
```

Expected smoke-check results: `--version` prints the installed OpenLegal version; `check` returns `valid: true` and `template_packages: 14`; `list` returns template IDs and recorded draft statuses. The CLI reads files only from this local checkout and reports recorded statuses as they are. A valid findings export or passing check does not imply legal approval.

For testers using the source checkout, share the public `BaseWorkers/openlegal-morocco` repository and an exact release tag. Ask them to report the command, OS, runtime versions, expected result, and actual result in a public GitHub issue, using only synthetic or public data.

## Feedback and reviewer applications

Use the [reviewer interest form](https://github.com/BaseWorkers/openlegal-morocco/issues/new?template=reviewer-interest.yml) to volunteer as a legal reviewer, language reviewer, research reviewer, or community moderator. Read the [reviewer onboarding guide](docs/REVIEWER_ONBOARDING.md) first. The issue form and replies are public; do not include private contact details, client information, or confidential documents. Tool testing and community feedback do not count as professional approval.

## Codex CLI plugin and MCP server

The Codex plugin packages the OpenLegal skill. The MCP server is a separate local stdio process that reads the installed package's catalogue; the plugin's skill uses it when configured.

From the repository root, the optional Codex plugin can be installed with:

```sh
codex plugin marketplace add ./codex-marketplace
codex plugin add open-legal-morocco --marketplace open-legal-morocco
```

Register the MCP server using the absolute path to this checkout's `mcp/server.py`:

```sh
codex mcp add openlegal -- openlegal-mcp
codex mcp list
```

If `openlegal` is already listed, keep the existing entry. Verify MCP by listing the server's tools, calling `list_templates` with `language: en`, then `get_review_status` with `template_id: privacy-policy`; expect draft status and a disclaimer. For source-checkout protocol tests, run `python3 -m unittest discover -s mcp -p 'test_*.py'`. See [MCP setup and safety limits](mcp/README.md) and [Codex plugin details](codex-marketplace/plugins/open-legal-morocco/README.md).
# Local Next.js and public-page scan (pre-release)

Install OpenLegal as a local development dependency in a Next.js project. Repository scanning is local-only. An optional HTTPS URL asks the same local process to inspect a small number of public HTML pages on that site.

```sh
npm install --save-dev openlegal
npx openlegal scan .
npx openlegal scan ./my-app --format json --language ar
npx openlegal scan . --url https://example.com --language ar --output openlegal-report.md
```

Markdown is the default format and Arabic is the default language. The report separates an estimated technical review-readiness signal from evidence coverage. Readiness starts at 100 and subtracts one priority-weighted penalty per distinct finding rule and 10 points per incomplete requested scope (informational 10, low 15, medium 25, high 40, critical 60); coverage reports completed selected scopes. Optional scopes that were not requested are listed as unscanned, not passed. Neither number measures legal risk or compliance. Critical findings are repeated near the top of the report and remain visible at any score. `--output` creates a new file and refuses to overwrite an existing path. The repository scanner detects Next.js and checks allowlisted source, markup, documentation, and `package.json` for privacy notices, cookie-storage APIs, tracking, and third-party indicators. Cookie storage alone is not classified as tracking. It skips hidden files, secrets, dependency/build directories, lockfiles, and symbolic links.

URL mode makes bounded HTTPS GET requests to the URL explicitly supplied by the developer. It checks the homepage and up to four same-origin privacy-route links, ignoring asset paths and query-bearing links; inaccessible page reports include the route and response reason. It rejects private/reserved DNS destinations and cross-origin redirects, caps each page at 2 MiB and each request at 10 seconds, and fetches HTML only. It does not execute JavaScript, submit forms, log in, or select consent options. Local repository scanning makes no network requests and never sends source files to OpenLegal. Findings do not prove that data is transmitted, that consent is absent, that a law applies, or that a project is compliant; legal interpretations remain pending qualified review.

The pre-release advisory action accepts the optional public URL only when supplied explicitly:

```yaml
- uses: BaseWorkers/openlegal-morocco/.github/actions/openlegal-scan@v0.1.1-next.1
  with:
    language: en
    url: https://example.com
```

The action does not fail the job because findings are present. `scan_repository` in the MCP server accepts the same explicit local path, optional HTTPS URL, and language, then returns the same Findings v2 output as the CLI. Supplying a URL explicitly authorizes the local tool to request that public site; no URL is contacted otherwise.
