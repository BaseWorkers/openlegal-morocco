#!/usr/bin/env python3
"""Read-only local MCP (JSON-RPC over stdio) for Open Legal Morocco.

Zero external dependencies; never alters templates or review records.
"""
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

def packages():
    for path in sorted(TEMPLATES.glob("*/*/metadata.yaml")):
        try:
            meta = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if isinstance(meta, dict) and isinstance(meta.get("id"), str):
            yield path.parent, meta

def choose(template_id):
    matches = [(p, m) for p, m in packages() if m["id"] == template_id]
    if len(matches) != 1:
        raise ValueError("Unknown or ambiguous template id")
    return matches[0]

def file_json(folder, name):
    path = folder / name
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {"unavailable": True}
    except ValueError:
        return {"unavailable": True, "reason": "invalid structured source"}

def call(name, args):
    if name == "list_templates":
        category = args.get("category")
        lang = args.get("language")
        if lang is not None and lang not in ("en", "fr", "ar"):
            raise ValueError("Invalid language")
        return {
            "templates": [
                {"id": m["id"], "title": m.get("title", {}),
                 "categories": m.get("category", []),
                 "languages": m.get("languages", []),
                 "version": m.get("version"),
                 "status": m.get("status"),
                 "legal_review": m.get("legal_review")}
                for _, m in packages()
                if (not category or category in m.get("category", []))
                and (not lang or lang in m.get("languages", []))
            ], "disclaimer": DISCLAIMER
        }
    if name in ("get_template", "get_template_sources"):
        template_id = args.get("template_id")
        if not isinstance(template_id, str) or not template_id:
            raise ValueError("template_id is required")
        folder, meta = choose(template_id)
        if name == "get_template_sources":
            return {"template_id": template_id, "metadata": meta,
                    "sources": file_json(folder, "sources.yaml"),
                    "disclaimer": DISCLAIMER}
        language = args.get("language", "en")
        if language not in ("en", "fr", "ar") or language not in meta.get("languages", []):
            raise ValueError("Unsupported language")
        path = folder / (language + ".md")
        if not path.is_file():
            raise ValueError("Template content missing")
        return {"metadata": meta, "language": language,
                "content": path.read_text(encoding="utf-8"),
                "disclaimer": DISCLAIMER}
    raise ValueError("Unknown tool")

TOOLS = [
    {"name": "list_templates", "description": "List unverified Moroccan legal discussion drafts and their actual review statuses. Never infer approval.", "inputSchema": {"type":"object","properties":{"category":{"type":"string"},"language":{"type":"string","enum":["en","fr","ar"]}},"additionalProperties":False}},
    {"name": "get_template", "description": "Read one draft in a requested language, including provenance and unverified status. Not legal advice.", "inputSchema":{"type":"object","properties":{"template_id":{"type":"string"},"language":{"type":"string","enum":["en","fr","ar"]}},"required":["template_id"],"additionalProperties":False}},
    {"name": "get_template_sources", "description": "Read declared sources for a draft; citations are NOT proof of current law or professional approval.", "inputSchema":{"type":"object","properties":{"template_id":{"type":"string"}},"required":["template_id"],"additionalProperties":False}},
]

def response(req):
    method = req.get("method")
    if method == "initialize":
        return {"protocolVersion": "2024-11-05", "capabilities": {"tools": {}},
                "serverInfo": {"name": "openlegal-morocco", "version": "0.1.0"}}
    if method == "ping":
        return {}
    if method == "tools/list":
        return {"tools": TOOLS}
    if method == "tools/call":
        params = req.get("params") or {}
        try:
            result = call(params.get("name"), params.get("arguments") or {})
            return {"content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False)}]}
        except (ValueError, OSError) as exc:
            return {"content": [{"type": "text", "text": str(exc)}], "isError": True}
    raise KeyError("Method not found")

def main():
    for line in sys.stdin:
        try:
            req = json.loads(line)
            if not isinstance(req, dict):
                continue
            # MCP notifications have no id and must not receive a response.
            if "id" not in req:
                continue
            try:
                result = response(req)
                output = {"jsonrpc": "2.0", "id": req["id"], "result": result}
            except KeyError:
                output = {"jsonrpc": "2.0", "id": req["id"],
                          "error": {"code": -32601, "message": "Method not found"}}
        except (ValueError, TypeError):
            output = {"jsonrpc": "2.0", "id": None,
                      "error": {"code": -32700, "message": "Parse error"}}
        print(json.dumps(output, ensure_ascii=False), flush=True)

if __name__ == "__main__":
    main()
