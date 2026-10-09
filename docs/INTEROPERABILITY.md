# Interoperability and structured findings

Open Legal Morocco publishes a vendor-neutral findings contract for independent developer tools, privacy infrastructure, security platforms, and agents. It identifies and documents technical observations and unresolved legal questions. It does not choose products, certify compliance, or approve legal conclusions.

## Version 1.0.0

- JSON Schema: [`schemas/findings.schema.json`](../schemas/findings.schema.json)
- Control taxonomy: [`schemas/control-taxonomy.json`](../schemas/control-taxonomy.json)
- Static API build copies both files to `dist/api/v1/`.
- CLI: `npm run cli -- findings validate findings.json` and `npm run cli -- findings render findings.json --format md|json` (`-` reads JSON from standard input).
- MCP: `get_findings_spec` returns the same schema and taxonomy; `export_findings` validates a supplied document and returns it unchanged. Clients negotiating protocol `2025-06-18` also receive the schema as `outputSchema` and the document in `structuredContent`; older supported clients receive the JSON text form. It does not inspect arbitrary repositories or mutate findings.
- Agent skill: use the same schema and taxonomy when preparing structured observations.

The export envelope contains `schema_version`, `generated_at`, `source`, `repository.revision`, `verification_limitations`, and `findings`. Each finding repeats the schema version, has an explicit `finding_type`, and separates its technical remediation `priority_basis` from legal review. Every finding must include at least one supporting evidence item with a sanitized summary and source reference. `technical_observation` records evidence-backed facts and requires `legal_question: null`. `potential_legal_question` requires a non-empty unresolved question; it is not a conclusion. The published JSON Schema enforces this distinction with standard conditional keywords so independent consumers can validate it without project-specific code. Legal reference verification and human review are separate states. `confidence` may be null when it cannot be meaningfully measured.

The shared technical urgency scale is: `informational` records context without requiring remediation; `low` is non-urgent work suitable for normal maintenance; `medium` should be planned into a near-term remediation cycle; `high` calls for prompt technical remediation or mitigation; `critical` calls for urgent containment or remediation based on severe, well-supported technical impact. Consumers should consider observed impact, scope, exploitability, and evidence confidence. These values describe technical remediation sequencing only; they do not assess legal risk, establish a legal duty, or indicate legal non-compliance.

The initial generic control identifiers are `pii_detection`, `data_minimization`, `redaction`, `tokenization`, `encryption`, `access_control`, `audit_logging`, `retention_management`, `data_flow_mapping`, and `third_party_disclosure`. Identifiers describe control objectives; independent tools may map them to their own capabilities without changing this project or adding a vendor dependency.

## Privacy and integration boundary

Interfaces are read-only by default. MCP exports validate and return the supplied document; they do not set review states. The CLI reads only the specified findings file (or standard input). Neither interface inspects private repositories or exchanges data with external services. Use explicit authorization before reviewing a private repository or sharing findings with an external adapter. No interface can automatically change legal-review states, approve findings, or modify production security policy.

Do not include raw personal data, credentials, or confidential payloads. Evidence uses sanitized summaries, file/source references, line ranges, and optional content digests rather than excerpts. CLI, MCP, and the independent adapter example scan every string field for several high-signal patterns (private-key headers, bearer tokens, common cloud key IDs, JWT-like values, and direct email addresses); this check is intentionally not described as complete PII or secret detection. Review output before sharing and keep exports local unless a user explicitly authorizes disclosure.

## Compatibility policy

The 1.0.0 contract on this unmerged branch is a pre-release draft and may be revised before its first release. At release, its schema and meanings will be frozen. After release, compatible optional additions receive a new minor schema version and versioned API artifact; removals, changed meanings, or newly required fields require a major version and migration note. Consumers validate against the schema version declared by the document; they should reject unsupported major versions and never infer approval from schema validity. Taxonomy identifiers are stable; proposed removals or semantic changes require a documented deprecation period and a versioned migration map.

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

`finding_id` is an opaque producer-assigned identifier: keep it stable when the same finding is carried into later exports, and keep it unique within each export. Do not encode secrets or personal data in identifiers. JSON Schema validates the individual identifier shape; the CLI and MCP validators enforce cross-finding uniqueness as a semantic constraint. Consumers can use the stable ID with producer/source context to track remediation across repository revisions; do not infer identity from descriptions or content hashes.

The same conformance corpus at [`tests/fixtures/findings-contract.json`](../tests/fixtures/findings-contract.json) is exercised by both CLI and MCP validator tests. It covers valid technical observations, potential legal questions, and rejection cases for missing evidence or required legal-question semantics, legal-risk priority framing, non-taxonomy controls, duplicate identifiers, and unsafe source paths. A focused test also runs the published schema directly against mismatched observation/question combinations.

For local, hash-only source comparison, see [Legal source change candidates](CHANGE_TRACKER.md). Candidate records remain unverified and do not represent a legal change.

## Read-only static API

`npm run build:api` generates these files from the same template catalogue and source registry used by the CLI and MCP server:

| Request path | Generated file | Contents |
| --- | --- | --- |
| `GET /api/v1/manifest.json` | `dist/api/v1/manifest.json` | API version, repository revision, template versions and recorded statuses |
| `GET /api/v1/templates.json` | `dist/api/v1/templates.json` | Catalogue index |
| `GET /api/v1/templates/{id}.json` | `dist/api/v1/templates/{id}.json` | Template metadata, language content, source declarations, per-language SHA-256 digests, and review status |
| `GET /api/v1/templates/{id}/sources.json` | `dist/api/v1/templates/{id}/sources.json` | Source declarations and available source records |
| `GET /api/v1/findings.schema.json` | `dist/api/v1/findings.schema.json` | Findings export schema v1.0.0 |
| `GET /api/v1/control-taxonomy.json` | `dist/api/v1/control-taxonomy.json` | Vendor-neutral control identifiers |

For a local smoke check without a hosted service, build and serve the generated directory with Python's standard library:

```sh
npm run build:api
python3 -m http.server 8000 --directory dist
```

In another terminal, request the manifest, catalogue, a template, and its sources:

```sh
curl --fail --silent --show-error http://127.0.0.1:8000/api/v1/manifest.json
curl --fail --silent --show-error http://127.0.0.1:8000/api/v1/templates.json
curl --fail --silent --show-error http://127.0.0.1:8000/api/v1/templates/privacy-policy.json
curl --fail --silent --show-error http://127.0.0.1:8000/api/v1/templates/privacy-policy/sources.json
```

The generator embeds the source repository revision and content digests so clients can associate records with a build and detect language-content changes. Static hosts may provide HTTP caching and validators such as ETags; the project does not require a specific host or claim a production API is deployed. Public artifacts retain their source licensing and attribution notices, report recorded review states without elevating them, and contain no private reviewer records. Consumers should cache by URL and content digest, check the API/schema version, and treat missing or unverified legal source information as unresolved.

### Independent consumer example

[`examples/findings-adapter/`](../examples/findings-adapter/) contains a dependency-free Node.js example that can be copied outside this repository. It reads only a findings JSON export, the published control taxonomy, and an optional mapping file owned by the consuming application. The example mapping uses an `organization.*` namespace to show that adapters can connect generic control IDs to their own capability names without changing this project or choosing a vendor.

After producing a findings export and building the static API, run:

```sh
npm run build:api
npm run cli -- findings render /path/to/findings.json --format json > findings.json
node examples/findings-adapter/consume.mjs findings.json dist/api/v1/control-taxonomy.json examples/findings-adapter/control-mapping.example.json
```

The adapter preserves source revision, evidence references, verification and human-review states, and unresolved legal questions. It never executes a mapped capability or changes a review state. It performs basic consistency checks only; consumers must use an independent JSON Schema 2020-12 validator with `dist/api/v1/findings.schema.json` for full contract validation. Mapping a control does not establish that the control is implemented, sufficient, or legally required.
