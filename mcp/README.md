# Open Legal Morocco MCP (local, read-only)

An experimental MCP stdio server exposing the repository's *existing* draft catalogue to compatible agents, including Codex. This does **not** conduct a legal audit, monitor changes to Moroccan law, evaluate deployed websites, or verify compliance. Those would require separately reviewed evidence and integrations.

## Requirements
- Python 3.10+
- Clone the entire repository locally (template files must be present)
- No Python dependencies or network access

## Run
```bash
python3 mcp/server.py
```

Configure your MCP client's stdio server command as `python3` (or `python` on Windows) and argument `/absolute/path/to/openlegal-morocco/mcp/server.py`. Set the working directory if your client requires it; this server locates templates relative to its own script.

### Codex CLI example (`~/.codex/config.toml`)
```toml
[mcp_servers.openlegal_morocco]
command = "python3"
args = ["/absolute/path/to/openlegal-morocco/mcp/server.py"]
```

Restart Codex after updating the config. The tool names are:
- `list_templates` (optional `category`, `language`)
- `get_template` (required `template_id`, optional `language`)
- `get_template_sources` (required `template_id`)

For example, list templates, then request `privacy-policy` in `ar`, then request that template's source declarations.

## Safety boundaries
- Every result includes the unverified-draft disclaimer.
- A template's review status is read from the actual `metadata.yaml`; no approval is inferred.
- Source declarations are research references, **not** confirmed/current legal requirements.
- No external URLs are fetched and no application repositories are scanned.
- No data is written; no arbitrary repository paths or shell commands are accepted.
- Never send personal/client/confidential data in queries or issues.
- Drafts are not ready for reliance or signature without qualified Moroccan legal advice.

This is the **first MCP foundation**, not a legal-compliance certification engine.
