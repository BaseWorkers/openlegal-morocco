# Open Legal Morocco MCP (local and read-only)

This experimental MCP server exposes the repository's existing template catalogue to compatible agents. It does not conduct legal research, evaluate deployed websites, monitor legal changes, or verify compliance.

## Requirements

- Python 3.10 or later
- A local checkout containing the template packages
- No Python dependencies or network access

## Run

```sh
python3 mcp/server.py
```

Configure an MCP client to start `python3` with the absolute path to `mcp/server.py`. For Codex CLI, add this to `~/.codex/config.toml`:

```toml
[mcp_servers.open_legal_morocco]
command = "python3"
args = ["/absolute/path/to/open-legal-morocco/mcp/server.py"]
```

On Windows, use `python` and an absolute Windows path. Restart the client after changing its configuration.

The server exposes `list_templates` (optional category and language filters), `get_template` (template ID and optional language), and `get_template_sources` (template ID). All calls return recorded status and the draft disclaimer. Source declarations are references, not proof that a rule is current or applies to a particular user.

## Safety boundaries

- Stdio only; it opens no network listener and makes no external requests.
- The tools read files under this repository's `templates/` directory. They do not write files, invoke shell commands, or accept arbitrary paths.
- Symbolic-link content and source files are rejected.
- Responses do not grant or infer legal or language approval, and never certify compliance.
- Never include personal, client, or confidential data in tool arguments.

## Tests and troubleshooting

Run `python3 -m unittest discover -s mcp -p 'test_*.py'`. If the client does not show the tools, confirm that the command and absolute script path are correct, that Python is on `PATH`, and that the client was restarted. Diagnostics for malformed package metadata go to stderr; stdout is reserved for JSON-RPC messages.
