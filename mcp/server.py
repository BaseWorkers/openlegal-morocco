#!/usr/bin/env python3
"""Read-only local MCP server for Open Legal Morocco (JSON-RPC over stdio)."""

import base64
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATES = ROOT / "templates"
FINDINGS_SCHEMA = ROOT / "schemas" / "findings.schema.json"
CONTROL_TAXONOMY = ROOT / "schemas" / "control-taxonomy.json"
SOURCE_REGISTRY = ROOT / "sources" / "registry.yaml"
OFFICIAL_SOURCE_MAP = ROOT / "sources" / "official-morocco.yaml"
REVIEW_RECORDS = ROOT / "reviews" / "records.json"
AUTHORIZED_REVIEWERS = ROOT / "reviews" / "authorized-reviewers.yaml"
REVIEW_RECORD_SCHEMA = ROOT / "schemas" / "review.schema.json"
AUTHORIZED_REVIEWERS_SCHEMA = ROOT / "schemas" / "authorized-reviewers.schema.json"
DISCLAIMER = (
    "Open Legal Morocco materials are unverified discussion drafts, not legal advice. "
    "Automated results do not certify Moroccan legal compliance. "
    "Seek qualified Moroccan legal counsel before relying on a document."
)
LANGUAGES = ("en", "fr", "ar")
MAX_MESSAGE_CHARS = 1024 * 1024
CHECKLIST_QUESTIONS = {
    "website": [
        {"id": "operator-and-audience", "topic": "business-context", "question": "Which entity operates the site, and where are the operator and intended users located?"},
        {"id": "data-and-purpose", "topic": "data-handling", "question": "What information is collected, for what purposes, and which systems or people can access it?"},
        {"id": "cookies-and-analytics", "topic": "tracking", "question": "Which cookies, analytics, advertising, or other tracking functions are enabled?"},
        {"id": "external-providers", "topic": "third-parties", "question": "Which hosting, payment, communication, analytics, or support providers may receive or access information?"},
        {"id": "customer-terms", "topic": "contracts", "question": "What is offered, and which price, cancellation, support, or other customer terms are shown?"},
    ],
    "mobile_app": [
        {"id": "operator-and-audience", "topic": "business-context", "question": "Which entity operates the app, and where are the operator and intended users located?"},
        {"id": "data-and-purpose", "topic": "data-handling", "question": "What information is collected, for what purposes, and which systems or people can access it?"},
        {"id": "device-permissions", "topic": "device-access", "question": "Which device permissions and sensors does the app request, and which features use them?"},
        {"id": "tracking-and-analytics", "topic": "tracking", "question": "Which analytics, advertising, crash-reporting, or attribution libraries are included?"},
        {"id": "external-providers", "topic": "third-parties", "question": "Which hosting, messaging, payment, or other providers may receive or access information?"},
    ],
    "saas": [
        {"id": "operator-and-customer", "topic": "business-context", "question": "Which entity operates the service, who are its customer types, and where are they located?"},
        {"id": "customer-data-and-roles", "topic": "data-handling", "question": "What customer and end-user information is stored, and who determines its purposes and uses?"},
        {"id": "provider-chain", "topic": "third-parties", "question": "Which hosting, support, analytics, or other providers can access customer information?"},
        {"id": "retention-and-exit", "topic": "retention", "question": "How are customer data, backups, and account records handled during service use and after termination?"},
        {"id": "security-operations", "topic": "security", "question": "How are access, security events, incident handling, and customer communications managed?"},
    ],
    "marketplace": [
        {"id": "platform-roles", "topic": "business-context", "question": "What roles do the platform, sellers, buyers, and payment providers each perform?"},
        {"id": "onboarding-and-data", "topic": "data-handling", "question": "What seller and buyer information is collected during onboarding and transactions?"},
        {"id": "fees-and-refunds", "topic": "commercial-terms", "question": "How are prices, platform fees, cancellations, refunds, and payouts presented and handled?"},
        {"id": "content-and-disputes", "topic": "content-and-disputes", "question": "How are listings, user submissions, complaints, and transaction disputes handled?"},
        {"id": "external-providers", "topic": "third-parties", "question": "Which payment, identity, hosting, messaging, or support providers receive platform information?"},
    ],
    "employer": [
        {"id": "workforce-and-locations", "topic": "employment-context", "question": "Which worker and contractor groups are involved, and where do they work?"},
        {"id": "worker-records", "topic": "data-handling", "question": "What worker information is collected, for which operational purposes, and who can access it?"},
        {"id": "workplace-systems", "topic": "systems-and-monitoring", "question": "Which HR, payroll, scheduling, access-control, or workplace-monitoring systems are used?"},
        {"id": "retention-and-providers", "topic": "retention", "question": "How are worker records retained, deleted, and shared with payroll or other service providers?"},
        {"id": "work-arrangements", "topic": "contracts", "question": "Which work arrangements, policies, and compensation terms need review for the intended roles?"},
    ],
    "other": [
        {"id": "operator-and-audience", "topic": "business-context", "question": "Which entity operates the product, and where are the operator and intended users located?"},
        {"id": "data-and-purpose", "topic": "data-handling", "question": "What information is collected, for what purposes, and which systems or people can access it?"},
        {"id": "external-providers", "topic": "third-parties", "question": "Which external providers receive information or perform services for the product?"},
        {"id": "contracts-and-content", "topic": "contracts", "question": "What products, services, user submissions, or commercial terms should counsel understand?"},
        {"id": "security-and-retention", "topic": "security", "question": "How are access, retention, deletion, and security events handled?"},
    ],
}
APP_TYPES = tuple(CHECKLIST_QUESTIONS)


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


def _read_repository_json(path, label):
    if path.is_symlink():
        raise ValueError(f"{label} cannot be a symbolic link")
    try:
        path.resolve().relative_to(ROOT.resolve())
        if path.stat().st_size > 1_048_576:
            raise ValueError(f"{label} exceeds the 1 MiB limit")
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, ValueError) as exc:
        raise ValueError(f"{label} is unavailable or invalid") from exc


def _read_package_text(folder, name):
    path = folder / name
    if path.is_symlink():
        raise ValueError(f"Template review input {name} cannot be a symbolic link")
    try:
        path.resolve().relative_to(folder.resolve())
        if path.stat().st_size > 1_048_576:
            raise ValueError(f"Template review input {name} exceeds the 1 MiB limit")
        return path.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise ValueError(f"Template review input {name} is missing") from exc
    except (OSError, UnicodeError) as exc:
        raise ValueError(f"Template review input {name} is unavailable") from exc


def _reviewable_content_digest(folder, metadata):
    """Mirror the repository's canonical digest inputs from validate-template-packages.mjs."""
    sources = json.loads(_read_package_text(folder, "sources.yaml"))
    if not isinstance(sources, dict) or not isinstance(sources.get("source_ids"), list):
        raise ValueError("Template source declarations are invalid")
    registry = _read_repository_json(SOURCE_REGISTRY, "Source registry")
    source_by_id = {item.get("id"): item for item in registry.get("sources", []) if isinstance(item, dict)}
    source_records = []
    for source_id in sorted(sources["source_ids"]):
        if not isinstance(source_id, str) or source_id not in source_by_id:
            raise ValueError("Template source declaration cannot be resolved")
        source_records.append(source_by_id[source_id])

    files = {}
    for language in metadata.get("languages", []):
        if language not in LANGUAGES:
            raise ValueError("Template declares an unsupported review language")
        files[f"{language}.md"] = _read_package_text(folder, f"{language}.md")
    variables = _read_package_text(folder, "variables.schema.json")
    source_declarations = _read_package_text(folder, "sources.yaml")
    notes = _read_package_text(folder, "notes.md")
    changelog = _read_package_text(folder, "CHANGELOG.md")
    reviewable_metadata = {
        key: value for key, value in metadata.items()
        if key not in {"status", "legal_review", "language_review", "language_review_records"}
    }
    files["variables.schema.json"] = variables
    files["sources.yaml"] = source_declarations
    files["source-records.json"] = json.dumps(source_records, ensure_ascii=False, indent=2) + "\n"
    files["notes.md"] = notes
    files["metadata.json"] = json.dumps(reviewable_metadata, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    files["CHANGELOG.md"] = changelog
    canonical = "\0".join(f"{path}\0{contents}" for path, contents in sorted(files.items()))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _signing_payload(record):
    def without_signatures(value):
        if isinstance(value, list):
            return [without_signatures(item) for item in value]
        if isinstance(value, dict):
            return {key: without_signatures(value[key]) for key in sorted(value) if key != "signature"}
        return value
    return json.dumps(without_signatures(record), ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def _verify_ed25519_signature(record, reviewer):
    signature = record.get("signature")
    if not isinstance(signature, dict) or signature.get("algorithm") != "Ed25519":
        return "invalid"
    key_id = signature.get("key_id")
    signature_text = signature.get("value")
    if not isinstance(key_id, str) or not isinstance(signature_text, str):
        return "invalid"
    keys = reviewer.get("signing_keys", []) if isinstance(reviewer, dict) else []
    key = next((item for item in keys if isinstance(item, dict) and item.get("id") == key_id and item.get("active") is True), None)
    public_key = key.get("public_key_pem") if key else None
    if not isinstance(public_key, str) or len(public_key) > 8192:
        return "invalid"
    try:
        signature_bytes = base64.b64decode(signature_text, validate=True)
    except (ValueError, TypeError):
        return "invalid"
    if not signature_bytes or base64.b64encode(signature_bytes).decode("ascii") != signature_text:
        return "invalid"
    if len(signature_bytes) != 64:
        return "invalid"
    openssl = shutil.which("openssl")
    if openssl is None:
        return "unavailable"
    try:
        with tempfile.TemporaryDirectory(prefix="openlegal-review-") as temporary:
            directory = Path(temporary)
            key_path = directory / "reviewer-public.pem"
            payload_path = directory / "record.json"
            signature_path = directory / "record.sig"
            key_path.write_text(public_key, encoding="utf-8")
            payload_path.write_bytes(_signing_payload(record))
            signature_path.write_bytes(signature_bytes)
            result = subprocess.run(
                [openssl, "pkeyutl", "-verify", "-pubin", "-inkey", str(key_path), "-rawin", "-in", str(payload_path), "-sigfile", str(signature_path)],
                capture_output=True, timeout=5, check=False,
            )
            return "verified" if result.returncode == 0 else "invalid"
    except (OSError, subprocess.TimeoutExpired):
        return "unavailable"


def _review_evidence(record_ids, metadata, folder):
    """Authenticate linked review records, reviewer authorization, and current-content binding."""
    if not record_ids:
        return [], "no_linked_records"
    document = _read_repository_json(REVIEW_RECORDS, "Review records")
    authorized = _read_repository_json(AUTHORIZED_REVIEWERS, "Authorized reviewer registry")
    if not isinstance(document, dict) or not isinstance(document.get("reviews"), list):
        raise ValueError("Review records are unavailable or invalid")
    if not isinstance(authorized, dict):
        raise ValueError("Authorized reviewer registry is unavailable or invalid")
    review_schema = _read_repository_json(REVIEW_RECORD_SCHEMA, "Review record schema")
    authorized_schema = _read_repository_json(AUTHORIZED_REVIEWERS_SCHEMA, "Authorized reviewer schema")
    authorized_errors = []
    _validate_schema_node(authorized, authorized_schema, authorized_schema, "authorized_reviewers", authorized_errors)
    if authorized_errors:
        raise ValueError("Authorized reviewer registry is invalid")
    legal_reviewers = authorized.get("authorized_legal_reviewers", [])
    language_reviewers = authorized.get("authorized_language_reviewers", [])
    if not isinstance(legal_reviewers, list) or not isinstance(language_reviewers, list):
        raise ValueError("Authorized reviewer registry is unavailable or invalid")
    records_by_id = {}
    for record in document["reviews"]:
        if isinstance(record, dict) and isinstance(record.get("id"), str):
            records_by_id.setdefault(record["id"], record)
    try:
        current_digest = _reviewable_content_digest(folder, metadata)
    except (OSError, UnicodeError, ValueError, TypeError):
        current_digest = None
    wanted = set(record_ids)
    summaries = []
    overall = "verified"
    for record_id in sorted(wanted):
        record = records_by_id.get(record_id)
        if not record:
            summaries.append({"id": record_id, "verification_status": "failed_or_incomplete", "verification_limits": ["linked_record_missing"]})
            overall = "failed_or_incomplete"
            continue
        record_errors = []
        _validate_schema_node(record, review_schema, review_schema, "review_record", record_errors)
        review_type = record.get("review_type")
        reviewer_pool = legal_reviewers if review_type == "legal" else language_reviewers if review_type == "language" else []
        reviewer = next((item for item in reviewer_pool if isinstance(item, dict) and item.get("id") == record.get("reviewer_id") and item.get("active") is True), None) if not record_errors else None
        failures = []
        if record_errors:
            failures.append("review_record_schema_invalid")
        if not record_errors and not reviewer:
            failures.append("reviewer_not_authorized")
        elif not record_errors and reviewer.get("authorized_at", "9999-99-99") > record.get("reviewed_at", ""):
            failures.append("reviewer_not_yet_authorized")
        signature_status = _verify_ed25519_signature(record, reviewer) if reviewer and not record_errors else "invalid"
        if signature_status != "verified":
            failures.append("signature_" + signature_status)
        if not current_digest:
            failures.append("current_digest_unavailable")
        elif record.get("content_digest") != current_digest:
            failures.append("content_digest_mismatch")
        if record.get("template_id") != metadata.get("id") or record.get("template_version") != metadata.get("version"):
            failures.append("template_scope_mismatch")
        if review_type == "legal":
            linked = metadata.get("legal_review")
            if not isinstance(linked, dict) or linked.get("status") != "reviewed" or linked.get("review_record_id") != record_id:
                failures.append("legal_review_metadata_link_mismatch")
            elif any(linked.get(field) != record.get(record_field) for field, record_field in (
                ("reviewer", "reviewer_id"), ("reviewed_at", "reviewed_at"), ("version", "template_version"),
            )):
                failures.append("legal_review_metadata_scope_mismatch")
            if record.get("outcome") != "approved":
                failures.append("legal_record_not_approved")
        elif review_type == "language":
            language_links = metadata.get("language_review_records", {})
            language_states = metadata.get("language_review", {})
            linked_languages = [code for code in metadata.get("languages", []) if isinstance(language_links, dict) and language_links.get(code) == record_id]
            if not linked_languages or any(not isinstance(language_states, dict) or language_states.get(code) != "reviewed" for code in linked_languages):
                failures.append("language_review_metadata_link_mismatch")
            if not record_errors and not set(linked_languages).issubset(set(record.get("languages", []))):
                failures.append("language_review_scope_mismatch")
            if record.get("outcome") != "approved":
                failures.append("language_record_not_approved")
        else:
            failures.append("unsupported_review_type")
        verification_status = "verified" if not failures else "failed_or_incomplete"
        if failures:
            if overall == "verified":
                overall = "verification_unavailable" if any(item.endswith("unavailable") for item in failures) else "failed_or_incomplete"
        summaries.append({
            "id": record.get("id"), "review_type": record.get("review_type"),
            "template_id": record.get("template_id"), "template_version": record.get("template_version"),
            "reviewer_id": record.get("reviewer_id"), "reviewed_at": record.get("reviewed_at"),
            "languages": record.get("languages"), "scope": record.get("scope"),
            "outcome": record.get("outcome"), "content_digest": record.get("content_digest"),
            "signature_present": isinstance(record.get("signature"), dict),
            "signature_verification": signature_status,
            "current_content_digest_match": bool(current_digest and record.get("content_digest") == current_digest),
            "verification_status": verification_status,
            "verification_limits": failures,
        })
    return summaries, overall


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
    for branch in schema.get("allOf", []):
        _validate_schema_node(value, branch, root_schema, path, errors)
    if "if" in schema:
        condition_errors = []
        _validate_schema_node(value, schema["if"], root_schema, path, condition_errors)
        if not condition_errors and "then" in schema:
            _validate_schema_node(value, schema["then"], root_schema, path, errors)
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
        if schema.get("format") == "date":
            try:
                if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value): raise ValueError("invalid date")
                datetime.strptime(value, "%Y-%m-%d")
            except ValueError: errors.append(f"{path} must be a date")
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]: errors.append(f"{path} is below minimum")
        if "maximum" in schema and value > schema["maximum"]: errors.append(f"{path} is above maximum")
    if isinstance(value, list):
        if len(value) < schema.get("minItems", 0): errors.append(f"{path} must contain at least {schema['minItems']} items")
        if len(value) > schema.get("maxItems", len(value)): errors.append(f"{path} must contain at most {schema['maxItems']} items")
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
    schema_controls = schema.get("$defs", {}).get("finding", {}).get("properties", {}).get("suggested_controls", {}).get("items", {}).get("enum", [])
    taxonomy_controls = [control.get("id") for control in taxonomy.get("controls", []) if isinstance(control, dict)]
    if schema_controls != taxonomy_controls:
        errors.append("Findings schema control identifiers do not match the published taxonomy")
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

    if name == "get_review_status":
        if set(args) - {"template_id", "language"}:
            raise ValueError("Unsupported get_review_status argument")
        template_id = args.get("template_id")
        if not isinstance(template_id, str) or not template_id:
            raise ValueError("template_id is required")
        folder, metadata = choose(template_id)
        language = args.get("language")
        languages = metadata.get("languages", [])
        if not isinstance(languages, list) or not languages or any(not isinstance(code, str) or code not in LANGUAGES for code in languages):
            raise ValueError("Template review language metadata is invalid")
        if language is not None and (language not in LANGUAGES or language not in languages):
            raise ValueError("Unsupported language")
        selected_languages = [language] if language else languages
        legal_review = metadata.get("legal_review")
        if not isinstance(legal_review, dict):
            legal_review = {"status": "unavailable"}
        language_review = metadata.get("language_review")
        language_review = language_review if isinstance(language_review, dict) else {}
        language_record_ids = metadata.get("language_review_records")
        language_record_ids = language_record_ids if isinstance(language_record_ids, dict) else {}
        record_ids = [legal_review.get("review_record_id")]
        record_ids.extend(language_record_ids.get(code) for code in selected_languages)
        record_ids = [record_id for record_id in record_ids if isinstance(record_id, str) and record_id]
        evidence_records, evidence_verification = _review_evidence(record_ids, metadata, folder)
        if legal_review.get("status") == "reviewed" and not legal_review.get("review_record_id"):
            evidence_verification = "failed_or_incomplete"
        if any(language_review.get(code) == "reviewed" and not language_record_ids.get(code) for code in selected_languages):
            evidence_verification = "failed_or_incomplete"
        return {
            "template_id": template_id,
            "template_version": metadata.get("version"),
            "recorded_status": metadata.get("status"),
            "legal_review": {
                "status": legal_review.get("status", "unavailable"),
                "reviewer_id": legal_review.get("reviewer"),
                "reviewed_at": legal_review.get("reviewed_at"),
                "reviewed_version": legal_review.get("version"),
                "record_id": legal_review.get("review_record_id"),
            },
            "language_reviews": {
                code: {
                    "status": language_review.get(code, "unavailable"),
                    "record_id": language_record_ids.get(code),
                }
                for code in selected_languages
            },
            "evidence_records": evidence_records,
            "evidence_verification": evidence_verification,
            "disclaimer": (
                "This reports recorded review fields and verifies linked records against the active repository reviewer "
                "registry, Ed25519 signature, exact template version, and current content digest when possible. A verified "
                "record proves integrity and control of an authorized signing key, not reviewer qualifications or legal "
                "accuracy. Verification can be unavailable when OpenSSL is absent or package inputs cannot be read. "
                "This tool does not change review status."
            ),
        }

    if name == "get_change_history":
        if set(args) != {"template_id"}:
            raise ValueError("get_change_history requires only template_id")
        template_id = args.get("template_id")
        if not isinstance(template_id, str) or not template_id:
            raise ValueError("template_id is required")
        folder, metadata = choose(template_id)
        changelog = folder / "CHANGELOG.md"
        if changelog.is_symlink():
            raise ValueError("Template changelog cannot be a symbolic link")
        try:
            changelog.resolve().relative_to(folder.resolve())
            if changelog.stat().st_size > 65536:
                raise ValueError("Template changelog exceeds the 64 KiB limit")
            history = changelog.read_text(encoding="utf-8")
        except FileNotFoundError as exc:
            raise ValueError("Template changelog is unavailable") from exc
        except (OSError, UnicodeError) as exc:
            raise ValueError("Template changelog is unavailable") from exc
        return {
            "template_id": template_id,
            "template_version": metadata.get("version"),
            "history_source": "template_changelog",
            "history": history,
            "disclaimer": (
                "This is maintainer-recorded changelog text from the local package. It is not independently verified, "
                "may not enumerate every source or content change, and does not establish legal meaning or approval."
            ),
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

    if name == "get_checklist":
        if set(args) != {"app_type"}: raise ValueError("get_checklist requires only app_type")
        app_type = args["app_type"]
        if not isinstance(app_type, str) or app_type not in CHECKLIST_QUESTIONS:
            raise ValueError(f"app_type must be one of: {', '.join(APP_TYPES)}")
        return {
            "app_type": app_type,
            "questions": CHECKLIST_QUESTIONS[app_type],
            "disclaimer": (
                "These are preliminary fact-gathering questions for discussion with qualified Moroccan counsel. "
                "They are not a complete checklist, legal advice, a compliance score, or a conclusion about applicable law."
            ),
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
        "name": "get_checklist",
        "description": "Return preliminary fact-gathering questions for counsel based on a coarse application type. This is not legal advice, a compliance score, or a conclusion about applicable law.",
        "inputSchema": {
            "type": "object",
            "properties": {"app_type": {"type": "string", "enum": list(APP_TYPES)}},
            "required": ["app_type"],
            "additionalProperties": False,
        },
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
    {
        "name": "get_review_status",
        "description": "Read recorded legal and language review fields and linked record summaries. This tool does not authenticate signatures or change review state.",
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
        "name": "get_change_history",
        "description": "Read a template package's local CHANGELOG.md. History is maintainer-recorded and does not establish legal meaning or approval.",
        "inputSchema": {
            "type": "object",
            "properties": {"template_id": {"type": "string"}},
            "required": ["template_id"],
            "additionalProperties": False,
        },
    },
]


STRUCTURED_OUTPUT_PROTOCOL = "2025-06-18"
SUPPORTED_PROTOCOLS = ("2024-11-05", "2025-03-26", STRUCTURED_OUTPUT_PROTOCOL)


def response(request, session=None):
    if session is None:
        session = {}
    method = request.get("method")
    if method == "initialize":
        params = request.get("params")
        requested = params.get("protocolVersion") if isinstance(params, dict) else None
        negotiated = requested if requested in SUPPORTED_PROTOCOLS else STRUCTURED_OUTPUT_PROTOCOL
        session["protocolVersion"] = negotiated
        return {
            "protocolVersion": negotiated,
            "capabilities": {"tools": {}},
            "serverInfo": {"name": "open-legal-morocco", "version": "0.1.0"},
        }
    if method == "ping":
        return {}
    if method == "tools/list":
        tools = json.loads(json.dumps(TOOLS))
        if session.get("protocolVersion") == STRUCTURED_OUTPUT_PROTOCOL:
            for tool in tools:
                if tool["name"] == "export_findings":
                    tool["outputSchema"] = json.loads(FINDINGS_SCHEMA.read_text(encoding="utf-8"))
        return {"tools": tools}
    if method == "tools/call":
        params = request.get("params")
        if not isinstance(params, dict) or not isinstance(params.get("name"), str):
            return {"content": [{"type": "text", "text": "Invalid tool call parameters"}], "isError": True}
        try:
            result = call(params["name"], params.get("arguments", {}))
            tool_result = {"content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False)}]}
            if params["name"] == "export_findings" and session.get("protocolVersion") == STRUCTURED_OUTPUT_PROTOCOL:
                tool_result["structuredContent"] = result
            return tool_result
        except (ValueError, OSError) as exc:
            return {"content": [{"type": "text", "text": str(exc)}], "isError": True}
    raise KeyError("Method not found")


def bounded_input_lines(stream):
    """Read newline-delimited messages without buffering an unbounded input line."""
    while True:
        chunks = []
        total_chars = 0
        oversized = False
        saw_input = False
        ended_with_newline = False
        while True:
            chunk = stream.readline(MAX_MESSAGE_CHARS + 1)
            if not chunk:
                break
            saw_input = True
            ended_with_newline = chunk.endswith("\n")
            if not oversized:
                total_chars += len(chunk)
                if total_chars > MAX_MESSAGE_CHARS:
                    oversized = True
                    chunks.clear()
                else:
                    chunks.append(chunk)
            if ended_with_newline:
                break
        if not saw_input:
            return
        yield None if oversized else "".join(chunks)
        if not ended_with_newline:
            return


def main():
    session = {}
    for line in bounded_input_lines(sys.stdin):
        if line is None:
            print(json.dumps({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": f"Request exceeds {MAX_MESSAGE_CHARS} characters"}}), flush=True)
            continue
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
            result = response(request, session)
            output = {"jsonrpc": "2.0", "id": request["id"], "result": result}
        except KeyError:
            output = {"jsonrpc": "2.0", "id": request["id"], "error": {"code": -32601, "message": "Method not found"}}
        print(json.dumps(output, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
