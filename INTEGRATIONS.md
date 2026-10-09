# Local CLI, MCP, and Codex plugin

OpenLegal includes read-only tools for its Morocco-focused discussion drafts. They do not provide legal advice, make network requests, change review statuses, or certify compliance.

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

Expected: `OpenLegal 0.0.3`, `valid: true`, and 14 template packages. These are Morocco-focused discussion drafts and remain unreviewed. The package has no JavaScript runtime dependencies.

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

Expected smoke-check results: `--version` prints `OpenLegal 0.0.3`; `check` returns `valid: true` and `template_packages: 14`; `list` returns template IDs and recorded draft statuses. The CLI reads files only from this local checkout and reports recorded statuses as they are. A valid findings export or passing check does not imply legal approval.

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
