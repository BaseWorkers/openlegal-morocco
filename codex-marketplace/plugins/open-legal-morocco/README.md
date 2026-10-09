# OpenLegal Codex plugin

This local plugin bundles the OpenLegal skill for Codex. It uses the read-only MCP server configured separately from the plugin.

## Install from this checkout

From the repository root, register the local marketplace and install the plugin:

```sh
codex plugin marketplace add ./codex-marketplace
codex plugin add open-legal-morocco --marketplace open-legal-morocco
```

The project's MCP server must also be registered with Codex CLI. From the repository root:

```sh
codex mcp add open_legal_morocco -- python3 "$(pwd)/mcp/server.py"
codex mcp list
```

If it is already listed, keep the existing entry. Restart Codex when its tools do not appear. Do not add a second server entry with another name.

The plugin's skill uses only the local catalogue tools, preserves recorded review states, and never treats a draft or automated check as legal approval. Its repository-inspection workflows require a clear user request and exclude secrets, customer data, and confidential material.
