# OpenLegal CLI and MCP testing

This release provides a local, read-only CLI and a stdio MCP server. The tools read this checkout's catalogue; they do not connect to a tester's private repository, make network requests, change files, or approve legal content.

## Install from npm

Requires Node.js 22 or newer.

```sh
npm install openlegal
npx openlegal --help
```

To install globally, run `npm install --global openlegal`. For MCP, configure the client to launch `openlegal-mcp`; it requires Python 3.10 or newer. The package contains Morocco-focused materials only, and all 14 templates remain drafts.

## Get the source release

```sh
git clone https://github.com/BaseWorkers/openlegal-morocco.git
cd openlegal-morocco
git checkout v0.0.3
```

## CLI smoke test

Requires Node.js 22 or newer. No dependency install is needed.

```sh
npm run cli -- --version
npm run cli -- check
npm run cli -- list --language en
npm run cli -- status privacy-policy
npm run cli -- sources privacy-policy
```

Expected: version `0.0.3`, a valid catalogue containing 14 packages, and `DRAFT` recorded review status.

## MCP smoke test

Requires Python 3.10 or newer. No pip installation is needed. Configure Codex with the local checkout path:

```sh
codex mcp add openlegal -- openlegal-mcp "$(pwd)/mcp/server.py"
codex mcp list
```

Restart Codex if its tools do not appear. In the client, list the server tools, call `list_templates` with `language: en`, then call `get_review_status` with `template_id: privacy-policy`. Expect draft status and a disclaimer. If the server name is already registered, keep that entry instead of adding a duplicate.

For protocol tests, run `python3 -m unittest discover -s mcp -p 'test_*.py'`.

## Bug reports

Report the operating system, Node.js/Python versions, command or MCP tool used, expected result, and actual result in a public GitHub issue. Include only synthetic or public data. Do not post client matters, personal information, credentials, or confidential files. Passing tools or positive feedback is not legal or language approval.
