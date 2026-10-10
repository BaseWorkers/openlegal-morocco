# OpenLegal MCP (local and read-only)

This experimental MCP server exposes the template catalogue, a local Next.js repository scanner, and an optional bounded public-HTML scan to compatible agents. It does not monitor legal changes or determine compliance.

## Requirements

- Python 3.10 or later
- A local checkout containing the template packages
- No Python package dependencies or network access
- OpenSSL is optional; when linked review records exist, the server uses the local `openssl` executable for Ed25519 verification and reports `verification_unavailable` if it is absent

## Run

For the npm package, install OpenLegal and launch its MCP entry point:

```sh
npm install --global openlegal
codex mcp add openlegal -- openlegal-mcp
```

The launcher uses `python3` (or `python` on Windows) and requires Python 3.10 or later. Set the `PYTHON` environment variable if your Python executable has another path. For source-checkout use, run `python3 mcp/server.py` as below.

```sh
python3 mcp/server.py
```

Configure an MCP client to start the Python server with an absolute script path. Codex CLI and IDE share their MCP configuration. From the repository root, register the server with the Codex CLI:

```sh
# macOS / Linux
codex mcp add open_legal_morocco -- python3 "/absolute/path/to/open-legal-morocco/mcp/server.py"

# Windows PowerShell, with the Python launcher installed
codex mcp add open_legal_morocco -- py -3 "C:\absolute\path\to\open-legal-morocco\mcp\server.py"
```

If the `py` launcher is unavailable on Windows, use `python` in its place. For manual setup, configure the MCP client with the same local stdio command and the absolute script path.

Use the absolute checkout path that exists on your machine; do not copy the sample path literally. Confirm registration with `codex mcp list`, then restart Codex if the tools do not appear. For manual configuration, use your MCP client's local stdio server settings with the same Python command and absolute script path. The format and command are documented in the [Codex MCP guide](https://developers.openai.com/learn/docs-mcp); `codex mcp add --help` shows the CLI form.

The server also exposes `scan_repository`, which requires an explicit `repository_path` and accepts optional `language` (`en`, `fr`, or `ar`) and public HTTPS `url`. It invokes the same scanner as the CLI and returns the same Findings v2 document. Repository mode does not execute inspected code or send source files to a network service. URL mode makes bounded HTML GET requests only when the caller explicitly supplies a URL.

Other tools include `list_templates` (optional category and language filters), `get_template` (template ID and optional language), `get_template_sources` (template ID), `get_review_status` (recorded status and verified review evidence where possible), `get_change_history` (local package changelog), `search_legal_sources` (local text/topic/type filters), `list_legal_topics` (topic IDs and local source counts), and `get_checklist` (preliminary fact-gathering questions selected by a coarse application type). The checklist is not complete legal advice, a compliance score, or a conclusion about applicable law. Responses preserve any recorded review status and state their limitations. Source declarations and search results are discovery aids, not proof that a rule is current or applies to a particular user.

## Safety boundaries

- Stdio only; it opens no network listener. No external request is made unless `scan_repository` receives an explicit public HTTPS URL.
- JSON-RPC input is newline-delimited and each message is limited to 1 Mi characters; oversized messages receive a parse error without buffering the remainder as one string.
- Catalogue tools read fixed catalogue, source, schema, changelog, and review files under this repository. `scan_repository` is the sole tool that accepts a local path, and it requires that path explicitly; it passes arguments without shell evaluation to the shared CLI scanner.
- The scanner reads allowlisted JavaScript/TypeScript, HTML, Markdown, and `package.json` files. It skips hidden files, secrets, dependencies, build output, lockfiles, and symbolic links; it enforces file-count, depth, and byte limits.
- Scan reports contain sanitized summaries and file/line or public-page references, not source excerpts. URL checks fetch HTML only, reject private/reserved addresses and cross-origin redirects, and never execute application JavaScript or interact with forms/consent.
- Responses do not grant or infer legal or language approval, and never certify compliance.
- Never include personal, client, or confidential data in tool arguments.

## Recorded review status

`get_review_status` reads the template's recorded legal and language review fields, optionally for one language, and includes narrow summaries of linked records. When linked records exist, it validates their schema, checks the active reviewer/key registry, verifies Ed25519 signatures with the local `openssl` executable, and compares the recorded digest with the current reviewable package content. It reports unavailable verification explicitly if OpenSSL or package inputs are unavailable. A verified signature and digest establish record integrity and control of an authorized key, not reviewer qualifications or legal accuracy. The tool does not alter any status. The current repository has no signed review records.

`get_change_history` reads only the selected package's `CHANGELOG.md` (with a 64 KiB limit). It reports maintainer-recorded history as written and does not independently reconstruct Git history, validate legal meaning, or imply review approval.

The catalog and templates remain the content source of truth; this tool does not create an independent review store.

## Tests and troubleshooting

Run `python3 -m unittest discover -s mcp -p 'test_*.py'`. If the client does not show the tools, confirm that the command and absolute script path are correct, that Python is on `PATH`, and that the client was restarted. Diagnostics for malformed package metadata go to stderr; stdout is reserved for JSON-RPC messages.
# Structured findings

The MCP server also exposes `get_findings_spec` (the current v2 JSON Schema, backward-compatible v1 schema, and generic controls) and `export_findings` (validate and echo a supplied sanitized document unchanged). See [`docs/INTEROPERABILITY.md`](../docs/INTEROPERABILITY.md) for the contract, privacy boundary, and versioning policy.

For clients negotiating MCP protocol `2025-06-18`, `export_findings` advertises both accepted schema versions in its `outputSchema` and returns the validated document in `structuredContent`, alongside JSON text for compatibility with text-oriented clients. Clients negotiating older supported protocol revisions receive the same validated JSON in text content without structured output fields.
