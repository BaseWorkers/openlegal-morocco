#!/usr/bin/env python3
"""Read-only local MCP server for Open Legal Morocco (JSON-RPC over stdio)."""

import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATES = ROOT / "templates"
FINDINGS_SCHEMA = ROOT / "schemas" / "findings.schema.json"
CONTROL_TAXONOMY = ROOT / "schemas" / "control-taxonomy.json"
SOURCE_REGISTRY = ROOT / "sources" / "registry.yaml"
OFFICIAL_SOURCE_MAP = ROOT / "sources" / "official-morocco.yaml"
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


def _source_index():
    registry = json.loads(SOURCE_REGISTRY.read_text(encoding="utf-8"))
    source_map = json.loads(OFFICIAL_SOURCE_MAP.read_text(encoding="utf-8"))
    source_topics = {}
    for entry in source_map.get("entries", []):
        source_id = entry.get("source_id")
        topic = entry.get("topic")
        if isinstance(source_id, str) and isinstance(topic, str):
            source_topics.setdefault(source_id, set()).add(topic)
    return registry.get("sources", []), source_topics


def _matches_type(value, expected):
    choices = expected if isinstance(expected, list) else [expected]
    return any({
        "object": lambda: isinstance(value, dict),
        "array": lambda: isinstance(value, list),
        "string": lambda: isinstance(value, str),
        "integer": lambda: isinstance(value, int) and not isinstance(value, bool),
        "number": lambda: isinstance(value, (int, float)) and not isinstance(value, bool),
        "boolean": lambda: isinstance(value, bool),
        "null": lambda: value is None,
    }[choice]() for choice in choices)


def _validate_schema_node(value, schema, root_schema, path, errors):
    if "$ref" in schema:
        target = root_schema
        for part in schema["$ref"].removeprefix("#/ ").replace("#/", "").split("/"):
            if part:
                target = target.get(part.replace("~1", "/").replace("~0", "~"), {})
        _validate_schema_node(value, target, root_schema, path, errors)
        return
    if "type" in schema and not _matches_type(value, schema["type"]):
        errors.append(f"{path} has an invalid type")
        return
    if "const" in schema and value != schema["const"]:
        errors.append(f"{path} must equal {schema['const']!r}")
    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path} must be one of the allowed values")
    if isinstance(value, str):
        if len(value) < schema.get("minLength", 0): errors.append(f"{path} is too short")
        if "pattern" in schema and re.search(schema["pattern"], value) is None: errors.append(f"{path} has an invalid format")
        if schema.get("format") == "date-time":
            try:
                if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})", value): raise ValueError("invalid RFC 3339")
                datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError: errors.append(f"{path} must be a date-time")
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]: errors.append(f"{path} is below minimum")
        if "maximum" in schema and value > schema["maximum"]: errors.append(f"{path} is above maximum")
    if isinstance(value, list):
        if schema.get("uniqueItems") and len({json.dumps(item, sort_keys=True) for item in value}) != len(value): errors.append(f"{path} contains duplicates")
        if "items" in schema:
            for index, item in enumerate(value): _validate_schema_node(item, schema["items"], root_schema, f"{path}[{index}]", errors)
    if isinstance(value, dict):
        for required in schema.get("required", []):
            if required not in value: errors.append(f"{path}.{required} is required")
        properties = schema.get("properties", {})
        for key, child in value.items():
            if key in properties: _validate_schema_node(child, properties[key], root_schema, f"{path}.{key}", errors)
            elif schema.get("additionalProperties") is False: errors.append(f"{path}.{key} is not allowed")


def validate_findings(document):
    schema = json.loads(FINDINGS_SCHEMA.read_text(encoding="utf-8"))
    taxonomy = json.loads(CONTROL_TAXONOMY.read_text(encoding="utf-8"))
    errors = []
    _validate_schema_node(document, schema, schema, "$", errors)
    known_controls = {control["id"] for control in taxonomy["controls"]}
    sensitive = re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+/-]{12,}|\bAKIA[0-9A-Z]{16}\b|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I)

    def text_values(value, path="$", found=None):
        if found is None:
            found = []
        if isinstance(value, str):
            found.append((path, value))
        elif isinstance(value, list):
            for index, item in enumerate(value):
                text_values(item, f"{path}[{index}]", found)
        elif isinstance(value, dict):
            for key, item in value.items():
                text_values(item, f"{path}.{key}", found)
        return found

    for path, text in text_values(document):
        if sensitive.search(text):
            errors.append(f"{path} appears to contain a credential, token, or direct email identifier")
    if isinstance(document, dict):
        finding_ids = set()
        findings = document.get("findings", [])
        if not isinstance(findings, list):
            return errors
        for index, finding in enumerate(findings):
            if not isinstance(finding, dict): continue
            finding_id = finding.get("finding_id")
            if isinstance(finding_id, str):
                if finding_id in finding_ids: errors.append(f"$.findings[{index}].finding_id is a duplicate finding_id")
                finding_ids.add(finding_id)
            if finding.get("finding_type") == "potential_legal_question" and (not isinstance(finding.get("legal_question"), str) or not finding["legal_question"].strip()): errors.append(f"$.findings[{index}].legal_question is required for a potential legal question")
            if finding.get("finding_type") == "technical_observation" and finding.get("legal_question") is not None: errors.append(f"$.findings[{index}].legal_question must be null for a technical observation")
            for control in finding.get("suggested_controls", []):
                if control not in known_controls: errors.append(f"$.findings[{index}] uses unknown control: {control}")
    return errors


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

    if name == "get_findings_spec":
        if args: raise ValueError("Unsupported get_findings_spec argument")
        return {
            "schema": json.loads(FINDINGS_SCHEMA.read_text(encoding="utf-8")),
            "taxonomy": json.loads(CONTROL_TAXONOMY.read_text(encoding="utf-8")),
            "disclaimer": "Technical priority is not a legal-risk rating. The specification does not certify legal compliance.",
        }

    if name == "search_legal_sources":
        if set(args) - {"query", "topic", "source_type", "limit"}:
            raise ValueError("Unsupported search_legal_sources argument")
        query = args.get("query", "")
        topic = args.get("topic")
        source_type = args.get("source_type")
        limit = args.get("limit", 20)
        source_types = {"official", "legislation", "regulatory-guidance", "reusable-template", "secondary-commentary", "project-policy", "license-text"}
        if not isinstance(query, str) or len(query) > 120:
            raise ValueError("query must be a string of at most 120 characters")
        if topic is not None and (not isinstance(topic, str) or not topic):
            raise ValueError("topic must be a non-empty string")
        if source_type is not None and (not isinstance(source_type, str) or source_type not in source_types):
            raise ValueError("Unsupported source_type")
        if not isinstance(limit, int) or isinstance(limit, bool) or not 1 <= limit <= 50:
            raise ValueError("limit must be an integer between 1 and 50")
        sources, source_topics = _source_index()
        needle = query.casefold()
        matches = []
        for source in sources:
            topics = sorted(source_topics.get(source.get("id"), set()))
            if topic and topic not in topics:
                continue
            if source_type and source.get("source_type") != source_type:
                continue
            searchable = " ".join(str(value) for value in (
                source.get("id", ""), source.get("title", ""), source.get("publisher", ""),
                source.get("jurisdiction", ""), source.get("source_type", ""), *source.get("used_for", []),
            )).casefold()
            if needle and needle not in searchable:
                continue
            matches.append({
                "id": source.get("id"), "title": source.get("title"),
                "publisher": source.get("publisher"), "jurisdiction": source.get("jurisdiction"),
                "source_type": source.get("source_type"), "url": source.get("url"),
                "verification_status": source.get("verification_status"),
                "verification_date": source.get("verification_date"),
                "reuse_status": source.get("reuse_status"), "topics": topics,
            })
        return {
            "sources": matches[:limit], "count": len(matches),
            "disclaimer": "Local source-index matches are discovery aids, not a complete source inventory or current-law verification and not a legal conclusion.",
        }

    if name == "list_legal_topics":
        if args:
            raise ValueError("Unsupported list_legal_topics argument")
        _, source_topics = _source_index()
        topic_sources = {}
        for source_id, topics in source_topics.items():
            for topic in topics:
                topic_sources.setdefault(topic, set()).add(source_id)
        return {
            "topics": [{"id": topic, "source_count": len(source_ids)} for topic, source_ids in sorted(topic_sources.items())],
            "disclaimer": "Topics reflect the current local source map and are not a complete taxonomy or statement of legal coverage.",
        }

    if name == "export_findings":
        if set(args) != {"document"}: raise ValueError("export_findings requires only a document")
        document = args["document"]
        errors = validate_findings(document)
        if errors: raise ValueError("Invalid findings document: " + "; ".join(errors[:8]))
        return document

    raise ValueError("Unknown tool")


TOOLS = [
    {
        "name": "get_findings_spec",
        "description": "Read the versioned findings JSON Schema and vendor-neutral control taxonomy.",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "export_findings",
        "description": "Validate and return a sanitized findings document unchanged. Does not approve legal findings or alter external systems.",
        "inputSchema": {"type": "object", "properties": {"document": {"type": "object"}}, "required": ["document"], "additionalProperties": False},
    },
    {
        "name": "search_legal_sources",
        "description": "Search the local curated source index by a short text query, topic, or source type. Results expose recorded verification and reuse states but do not determine current law.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "maxLength": 120},
                "topic": {"type": "string"},
                "source_type": {"type": "string", "enum": ["official", "legislation", "regulatory-guidance", "reusable-template", "secondary-commentary", "project-policy", "license-text"]},
                "limit": {"type": "integer", "minimum": 1, "maximum": 50},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "list_legal_topics",
        "description": "List topic IDs in the local source map and their source-record counts. The taxonomy is not complete and does not imply legal coverage.",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
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
