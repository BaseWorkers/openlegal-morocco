# Interoperability and structured findings

Open Legal Morocco publishes a vendor-neutral findings contract for independent developer tools, privacy infrastructure, security platforms, and agents. It identifies and documents technical observations and unresolved legal questions. It does not choose products, certify compliance, or approve legal conclusions.

## Version 1.0.0

- JSON Schema: [`schemas/findings.schema.json`](../schemas/findings.schema.json)
- Control taxonomy: [`schemas/control-taxonomy.json`](../schemas/control-taxonomy.json)
- Static API build copies both files to `dist/api/v1/`.
- CLI: `npm run cli -- findings validate findings.json` and `npm run cli -- findings render findings.json --format md|json` (`-` reads JSON from standard input).
- MCP: `get_findings_spec` returns the same schema and taxonomy; `export_findings` validates a supplied document and returns it unchanged. It does not inspect arbitrary repositories or mutate findings.
- Agent skill: use the same schema and taxonomy when preparing structured observations.

The export envelope contains `schema_version`, `generated_at`, `source`, `repository.revision`, `verification_limitations`, and `findings`. Each finding repeats the schema version, has an explicit `finding_type`, and separates its technical remediation `priority_basis` from legal review. `technical_observation` records evidence-backed facts. `potential_legal_question` states an unresolved question; it is not a conclusion. Legal reference verification and human review are separate states. `confidence` may be null when it cannot be meaningfully measured.

The initial generic control identifiers are `pii_detection`, `data_minimization`, `redaction`, `tokenization`, `encryption`, `access_control`, `audit_logging`, `retention_management`, `data_flow_mapping`, and `third_party_disclosure`. Identifiers describe control objectives; independent tools may map them to their own capabilities without changing this project or adding a vendor dependency.

## Privacy and integration boundary

Interfaces are read-only by default. MCP exports validate and return the supplied document; they do not set review states. The CLI reads only the specified findings file (or standard input). Neither interface inspects private repositories or exchanges data with external services. Use explicit authorization before reviewing a private repository or sharing findings with an external adapter. No interface can automatically change legal-review states, approve findings, or modify production security policy.

Do not include raw personal data, credentials, or confidential payloads. Evidence uses sanitized summaries, file/source references, line ranges, and optional content digests rather than excerpts. CLI and MCP validation reject several high-signal patterns (private-key headers, bearer tokens, common cloud key IDs, JWT-like values, and direct email addresses); this check is intentionally not described as complete PII or secret detection. Review output before sharing and keep exports local unless a user explicitly authorizes disclosure.

## Compatibility policy

The schema uses semantic versioning. Version 1.0.0 is frozen; compatible optional additions receive a new minor schema version and versioned API artifact. Removals, changed meanings, or newly required fields require a major version and migration note. Consumers validate against the schema version declared by the document; they should reject unsupported major versions and never infer approval from schema validity. Taxonomy identifiers are stable; proposed removals or semantic changes require a documented deprecation period and a versioned migration map.

## Example

```json
{
  "schema_version": "1.0.0",
  "generated_at": "2026-10-09T10:00:00Z",
  "source": { "tool": "example-agent", "version": "0.1.0" },
  "repository": { "revision": "abc123" },
  "verification_limitations": ["No legal review was performed."],
  "findings": [
    {
      "finding_id": "scan-001",
      "finding_type": "technical_observation",
      "category": "data-handling",
      "priority": "medium",
      "priority_basis": "technical_remediation",
      "description": "A request handler writes a user-provided field to an application log.",
      "legal_question": null,
      "evidence": [{
        "summary": "The handler passes the request field to the logger.",
        "source_reference": { "kind": "repository_file", "path": "src/handler.js", "line_start": 42, "line_end": 42, "content_digest": null },
        "verification_status": "verified"
      }],
      "affected_resources": [{ "type": "file", "identifier": "src/handler.js" }],
      "legal_references": [],
      "suggested_controls": ["data_minimization", "redaction"],
      "review_status": { "verification": "verified", "human_review": "not_requested" },
      "confidence": null,
      "schema_version": "1.0.0"
    }
  ]
}
```

The example describes a technical observation only. Its priority is not a legal-risk score and the presence of a suggested control is not a compliance determination.

`finding_id` values must be unique within each export. JSON Schema validates the individual identifier shape; the CLI and MCP validators enforce cross-finding uniqueness as a semantic constraint.

For local, hash-only source comparison, see [Legal source change candidates](CHANGE_TRACKER.md). Candidate records remain unverified and do not represent a legal change.
