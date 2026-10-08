#!/usr/bin/env python3
"""Read-only local MCP server for Open Legal Morocco (JSON-RPC over stdio)."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATES = ROOT / "templates"
DISCLAIMER = (
    "Open Legal Morocco materials are unverified discussion drafts, not legal advice. "
    "Automated results do not certify Moroccan legal compliance. "
    "Seek qualified Moroccan legal counsel before relying on a document."
)
LANGUAGES = ("en", "fr", "ar")


def packages():
    """Yield valid packages in deterministic order; report malformed records to stderr."""
    for metadata_path in sorted(TEMPLATES.glob("*/*/metadata.yaml")):
        package_path = metadata_path.parent
        try:
            package_path.resolve().relative_to(TEMPLATES.resolve())
        except (OSError, ValueError):
            print(f"Skipping template outside repository: {metadata_path}", file=sys.stderr)
            continue
        current = package_path
        if metadata_path.is_symlink():
            print(f"Skipping symlinked template metadata: {metadata_path}", file=sys.stderr)
            continue
        while current != TEMPLATES:
            if current.is_symlink():
                print(f"Skipping symlinked template package: {metadata_path}", file=sys.stderr)
                break
            current = current.parent
        else:
            current = None
        if current is not None:
            continue
        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, ValueError) as exc:
            print(f"Skipping unreadable template metadata {metadata_path}: {exc}", file=sys.stderr)
            continue
        if not isinstance(metadata, dict) or not isinstance(metadata.get("id"), str):
            print(f"Skipping template metadata without a string id: {metadata_path}", file=sys.stderr)
            continue
        yield metadata_path.parent, metadata


def choose(template_id):
    matches = [(folder, metadata) for folder, metadata in packages() if metadata["id"] == template_id]
    if len(matches) != 1:
        raise ValueError("Unknown or ambiguous template id")
    folder, metadata = matches[0]
    try:
        folder.resolve().relative_to(TEMPLATES.resolve())
    except (OSError, ValueError) as exc:
        raise ValueError("Template path is outside the repository") from exc
    return folder, metadata


def read_source_declarations(folder):
    path = folder / "sources.yaml"
    if path.is_symlink():
        raise ValueError("Template source declarations cannot be a symbolic link")
    try:
        path.resolve().relative_to(folder.resolve())
    except (OSError, ValueError) as exc:
        raise ValueError("Template source path is outside its package") from exc
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {"unavailable": True}
    except (OSError, UnicodeError, ValueError):
        return {"unavailable": True, "reason": "invalid structured source declarations"}


def call(name, args):
    if not isinstance(args, dict):
        raise ValueError("Tool arguments must be an object")

    if name == "list_templates":
        extra = set(args) - {"category", "language"}
        if extra:
            raise ValueError("Unsupported list_templates argument")
        category = args.get("category")
        language = args.get("language")
        if category is not None and (not isinstance(category, str) or not category):
            raise ValueError("Invalid category")
        if language is not None and language not in LANGUAGES:
            raise ValueError("Invalid language")
        templates = []
        for _, metadata in packages():
            categories = metadata.get("category", [])
            languages = metadata.get("languages", [])
            if not isinstance(categories, list) or not isinstance(languages, list):
                continue
            if category and category not in categories:
                continue
            if language and language not in languages:
                continue
            templates.append({
                "id": metadata["id"],
                "title": metadata.get("title", {}),
                "categories": categories,
                "languages": languages,
                "version": metadata.get("version"),
                "status": metadata.get("status"),
                "legal_review": metadata.get("legal_review"),
            })
        ids = [item["id"] for item in templates]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate template ids found")
        return {"templates": templates, "disclaimer": DISCLAIMER}

    if name in ("get_template", "get_template_sources"):
        allowed = {"template_id"} if name == "get_template_sources" else {"template_id", "language"}
        if set(args) - allowed:
            raise ValueError("Unsupported tool argument")
        template_id = args.get("template_id")
        if not isinstance(template_id, str) or not template_id:
            raise ValueError("template_id is required")
        folder, metadata = choose(template_id)
        if name == "get_template_sources":
            return {
                "template_id": template_id,
                "metadata": metadata,
                "sources": read_source_declarations(folder),
                "disclaimer": DISCLAIMER,
            }

        language = args.get("language", "en")
        if language not in LANGUAGES or language not in metadata.get("languages", []):
            raise ValueError("Unsupported language")
        content_path = folder / f"{language}.md"
        if content_path.is_symlink():
            raise ValueError("Template content cannot be a symbolic link")
        try:
            content_path.resolve().relative_to(folder.resolve())
            content = content_path.read_text(encoding="utf-8")
        except FileNotFoundError as exc:
            raise ValueError("Template content missing") from exc
        except (OSError, UnicodeError, ValueError) as exc:
            raise ValueError("Template content is unavailable") from exc
        return {
            "metadata": metadata,
            "language": language,
            "content": content,
            "disclaimer": DISCLAIMER,
        }

    raise ValueError("Unknown tool")


TOOLS = [
    {
        "name": "list_templates",
        "description": "List discussion drafts and their recorded review statuses. This never infers approval.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "category": {"type": "string"},
                "language": {"type": "string", "enum": list(LANGUAGES)},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "get_template",
        "description": "Read a discussion draft in one language with its recorded metadata and limitations.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "template_id": {"type": "string"},
                "language": {"type": "string", "enum": list(LANGUAGES)},
            },
            "required": ["template_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_template_sources",
        "description": "Read a draft's declared source references; declarations do not prove current law or approval.",
        "inputSchema": {
            "type": "object",
            "properties": {"template_id": {"type": "string"}},
            "required": ["template_id"],
            "additionalProperties": False,
        },
    },
]


def response(request):
    method = request.get("method")
    if method == "initialize":
        return {
            "protocolVersion": "2024-11-05",
            "capabilities": {"tools": {}},
            "serverInfo": {"name": "open-legal-morocco", "version": "0.1.0"},
        }
    if method == "ping":
        return {}
    if method == "tools/list":
        return {"tools": TOOLS}
    if method == "tools/call":
        params = request.get("params")
        if not isinstance(params, dict) or not isinstance(params.get("name"), str):
            return {"content": [{"type": "text", "text": "Invalid tool call parameters"}], "isError": True}
        try:
            result = call(params["name"], params.get("arguments", {}))
            return {"content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False)}]}
        except (ValueError, OSError) as exc:
            return {"content": [{"type": "text", "text": str(exc)}], "isError": True}
    raise KeyError("Method not found")


def main():
    for line in sys.stdin:
        try:
            request = json.loads(line)
        except (ValueError, TypeError):
            print(json.dumps({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}}), flush=True)
            continue
        if not isinstance(request, dict) or request.get("jsonrpc") != "2.0" or not isinstance(request.get("method"), str):
            if isinstance(request, dict) and "id" not in request:
                continue
            request_id = request.get("id") if isinstance(request, dict) else None
            print(json.dumps({"jsonrpc": "2.0", "id": request_id, "error": {"code": -32600, "message": "Invalid Request"}}), flush=True)
            continue
        if "id" not in request:
            # MCP notifications, including notifications/initialized, never receive a response.
            continue
        try:
            result = response(request)
            output = {"jsonrpc": "2.0", "id": request["id"], "result": result}
        except KeyError:
            output = {"jsonrpc": "2.0", "id": request["id"], "error": {"code": -32601, "message": "Method not found"}}
        print(json.dumps(output, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
