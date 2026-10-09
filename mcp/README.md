# Open Legal Morocco MCP (local and read-only)

This experimental MCP server exposes the repository's existing template catalogue to compatible agents. It does not conduct legal research, evaluate deployed websites, monitor legal changes, or verify compliance.

## Requirements

- Python 3.10 or later
- A local checkout containing the template packages
- No Python package dependencies or network access
- OpenSSL is optional; when linked review records exist, the server uses the local `openssl` executable for Ed25519 verification and reports `verification_unavailable` if it is absent

## Run

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

If the `py` launcher is unavailable on Windows, use `python` in its place. These commands store local paths in the Codex user configuration. For a manual setup, add this TOML to `~/.codex/config.toml` (macOS/Linux) or `%USERPROFILE%\\.codex\\config.toml` (Windows):

```toml
[mcp_servers.open_legal_morocco]
command = "python3" # use "py" on Windows
args = ["/absolute/path/to/open-legal-morocco/mcp/server.py"] # Windows: "C:\\absolute\\path\\to\\open-legal-morocco\\mcp\\server.py"
```

Use the absolute checkout path that exists on your machine; do not copy the sample path literally. Confirm registration with `codex mcp list`, then restart Codex if the tools do not appear. The MCP configuration format and command are documented in the [Codex MCP guide](https://developers.openai.com/learn/docs-mcp); `codex mcp add --help` shows the local stdio command form.

The server exposes `list_templates` (optional category and language filters), `get_template` (template ID and optional language), `get_template_sources` (template ID), `get_review_status` (recorded status and verified review evidence where possible), `get_change_history` (local package changelog), `search_legal_sources` (local text/topic/type filters), `list_legal_topics` (topic IDs and local source counts), and `get_checklist` (preliminary fact-gathering questions selected by a coarse application type). The checklist is not complete legal advice, a compliance score, or a conclusion about applicable law. All calls return recorded status and clear limitations. Source declarations and search results are discovery aids, not proof that a rule is current or applies to a particular user.

## Safety boundaries

- Stdio only; it opens no network listener and makes no external requests.
- The tools read fixed catalogue, source, schema, changelog, and review files under this repository. They do not write files, execute a shell, or accept arbitrary paths. Review verification uses a fixed local OpenSSL argument list without shell evaluation.
- Symbolic-link package directories, content files, and source files are rejected.
- Responses do not grant or infer legal or language approval, and never certify compliance.
- Never include personal, client, or confidential data in tool arguments.

## Recorded review status

`get_review_status` reads the template's recorded legal and language review fields, optionally for one language, and includes narrow summaries of linked records. When linked records exist, it validates their schema, checks the active reviewer/key registry, verifies Ed25519 signatures with the local `openssl` executable, and compares the recorded digest with the current reviewable package content. It reports unavailable verification explicitly if OpenSSL or package inputs are unavailable. A verified signature and digest establish record integrity and control of an authorized key, not reviewer qualifications or legal accuracy. The tool does not alter any status. The current repository has no signed review records.

`get_change_history` reads only the selected package's `CHANGELOG.md` (with a 64 KiB limit). It reports maintainer-recorded history as written and does not independently reconstruct Git history, validate legal meaning, or imply review approval.

The catalog and templates remain the content source of truth; this tool does not create an independent review store.

## Tests and troubleshooting

Run `python3 -m unittest discover -s mcp -p 'test_*.py'`. If the client does not show the tools, confirm that the command and absolute script path are correct, that Python is on `PATH`, and that the client was restarted. Diagnostics for malformed package metadata go to stderr; stdout is reserved for JSON-RPC messages.
# Structured findings

The MCP server also exposes `get_findings_spec` (the shared v1 JSON Schema and generic controls) and `export_findings` (validate and echo a supplied sanitized document unchanged). These tools do not scan caller repositories, contact external services, change human review states, or modify security policies. See [`docs/INTEROPERABILITY.md`](../docs/INTEROPERABILITY.md) for the export contract, privacy boundary, and versioning policy.
