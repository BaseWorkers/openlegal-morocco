"""Regression tests for the local read-only MCP server."""

import base64
import contextlib
import importlib.util
import io
import json
import shutil
import subprocess
from pathlib import Path
import tempfile
import unittest
from unittest import mock

SERVER = Path(__file__).with_name("server.py")
spec = importlib.util.spec_from_file_location("openlegal_mcp_server", SERVER)
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


class MCPTests(unittest.TestCase):
    def test_catalogue_has_actual_draft_states_and_disclaimer(self):
        result = server.call("list_templates", {})
        self.assertEqual(len(result["templates"]), 14)
        self.assertIn("not legal advice", result["disclaimer"])
        for item in result["templates"]:
            self.assertEqual(item["status"], "DRAFT")
            self.assertIn("status", item["legal_review"])

    def test_category_and_language_filters(self):
        result = server.call("list_templates", {"category": "privacy", "language": "ar"})
        self.assertTrue(result["templates"])
        self.assertTrue(all("privacy" in item["categories"] for item in result["templates"]))
        self.assertTrue(all("ar" in item["languages"] for item in result["templates"]))

    def test_get_template_and_sources(self):
        sources = server.call("get_template_sources", {"template_id": "privacy-policy"})
        self.assertIn("cndp-loi-09-08", sources["sources"]["source_ids"])
        result = server.call("get_template", {"template_id": "privacy-policy", "language": "ar"})
        self.assertEqual(result["metadata"]["status"], "DRAFT")
        self.assertEqual(result["language"], "ar")
        self.assertTrue(result["content"])
        self.assertIn("not legal advice", result["disclaimer"])

    def test_review_status_reports_only_recorded_evidence_and_limits(self):
        result = server.call("get_review_status", {"template_id": "privacy-policy", "language": "fr"})
        self.assertEqual(result["template_id"], "privacy-policy")
        self.assertEqual(result["template_version"], "0.1.3")
        self.assertEqual(result["recorded_status"], "DRAFT")
        self.assertEqual(result["legal_review"]["status"], "pending")
        self.assertEqual(result["language_reviews"]["fr"]["status"], "pending")
        self.assertEqual(result["evidence_verification"], "no_linked_records")
        self.assertIn("not reviewer qualifications", result["disclaimer"])
        with self.assertRaisesRegex(ValueError, "Unsupported language"):
            server.call("get_review_status", {"template_id": "privacy-policy", "language": "es"})
        with self.assertRaisesRegex(ValueError, "Unknown or ambiguous"):
            server.call("get_review_status", {"template_id": "missing-template"})

    def test_review_status_authenticates_signature_authorization_and_current_digest(self):
        openssl = shutil.which("openssl")
        if openssl is None:
            self.skipTest("OpenSSL is required to test Ed25519 review verification")
        folder, original = server.choose("privacy-policy")
        metadata = json.loads(json.dumps(original))
        digest = server._reviewable_content_digest(folder, metadata)
        record = {
            "id": "synthetic-legal-review", "template_id": metadata["id"],
            "template_version": metadata["version"], "review_type": "legal",
            "reviewer_id": "synthetic-reviewer", "reviewed_at": "2026-10-09",
            "languages": ["en", "fr", "ar"], "scope": "Synthetic test only",
            "outcome": "approved", "content_digest": digest,
            "signature": {"algorithm": "Ed25519", "key_id": "synthetic-key", "value": ""},
        }
        metadata["legal_review"] = {
            "status": "reviewed", "reviewer": "synthetic-reviewer",
            "reviewed_at": record["reviewed_at"], "version": metadata["version"],
            "review_record_id": record["id"],
        }
        with tempfile.TemporaryDirectory(dir=server.ROOT) as tmp:
            directory = Path(tmp)
            private_key = directory / "private.pem"
            public_key = directory / "public.pem"
            payload_path = directory / "payload.json"
            signature_path = directory / "signature.bin"
            subprocess.run([openssl, "genpkey", "-algorithm", "Ed25519", "-out", str(private_key)], check=True, capture_output=True)
            subprocess.run([openssl, "pkey", "-in", str(private_key), "-pubout", "-out", str(public_key)], check=True, capture_output=True)
            payload_path.write_bytes(server._signing_payload(record))
            subprocess.run([openssl, "pkeyutl", "-sign", "-rawin", "-inkey", str(private_key), "-in", str(payload_path), "-out", str(signature_path)], check=True, capture_output=True)
            record["signature"]["value"] = base64.b64encode(signature_path.read_bytes()).decode("ascii")
            records_file = directory / "records.json"
            reviewers_file = directory / "reviewers.json"
            records_file.write_text(json.dumps({"reviews": [record]}), encoding="utf-8")
            reviewers_file.write_text(json.dumps({"schema_version": 1, "authorized_legal_reviewers": [{
                "id": "synthetic-reviewer", "display_name": "Synthetic Reviewer", "active": True,
                "authorized_at": "2026-01-01", "authorization_record": "synthetic test fixture",
                "signing_keys": [{"id": "synthetic-key", "active": True, "public_key_pem": public_key.read_text(encoding="utf-8")}],
            }], "authorized_language_reviewers": []}), encoding="utf-8")
            with mock.patch.object(server, "REVIEW_RECORDS", records_file), \
                 mock.patch.object(server, "AUTHORIZED_REVIEWERS", reviewers_file), \
                 mock.patch.object(server, "packages", side_effect=lambda: iter([(folder, metadata)])):
                result = server.call("get_review_status", {"template_id": metadata["id"]})
                self.assertEqual(result["evidence_verification"], "verified")
                self.assertEqual(result["evidence_records"][0]["signature_verification"], "verified")
                self.assertTrue(result["evidence_records"][0]["current_content_digest_match"])
                with mock.patch.object(server.shutil, "which", return_value=None):
                    unavailable = server.call("get_review_status", {"template_id": metadata["id"]})
                self.assertEqual(unavailable["evidence_verification"], "verification_unavailable")
                self.assertEqual(unavailable["evidence_records"][0]["signature_verification"], "unavailable")

                original_title = metadata["title"]["en"]
                metadata["title"]["en"] = original_title + " changed"
                stale = server.call("get_review_status", {"template_id": metadata["id"]})
                self.assertEqual(stale["evidence_records"][0]["signature_verification"], "verified")
                self.assertFalse(stale["evidence_records"][0]["current_content_digest_match"])
                self.assertIn("content_digest_mismatch", stale["evidence_records"][0]["verification_limits"])
                metadata["title"]["en"] = original_title

                record["scope"] = "Tampered after signing"
                records_file.write_text(json.dumps({"reviews": [record]}), encoding="utf-8")
                tampered = server.call("get_review_status", {"template_id": metadata["id"]})
                self.assertEqual(tampered["evidence_verification"], "failed_or_incomplete")
                self.assertEqual(tampered["evidence_records"][0]["signature_verification"], "invalid")

                record["reviewed_at"] = []
                records_file.write_text(json.dumps({"reviews": [record]}), encoding="utf-8")
                malformed = server.call("get_review_status", {"template_id": metadata["id"]})
                self.assertEqual(malformed["evidence_verification"], "failed_or_incomplete")
                self.assertIn("review_record_schema_invalid", malformed["evidence_records"][0]["verification_limits"])

    def test_python_review_digest_matches_repository_validator_for_all_templates(self):
        node = shutil.which("node")
        if node is None:
            self.skipTest("Node is required for cross-language review digest parity")
        script = r"""
import { readFileSync, readdirSync } from 'node:fs';
import { digestReviewableContent, resolveReviewSourceRecords } from './scripts/review-policy.mjs';
import { reviewableMetadata } from './scripts/template-package-utils.mjs';
const registry = JSON.parse(readFileSync('sources/registry.yaml', 'utf8'));
const digests = {};
for (const category of readdirSync('templates', { withFileTypes: true }).filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
  const categoryPath = 'templates/' + category.name;
  for (const entry of readdirSync(categoryPath, { withFileTypes: true }).filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const folder = categoryPath + '/' + entry.name;
    const metadata = JSON.parse(readFileSync(folder + '/metadata.yaml', 'utf8'));
    const declarations = JSON.parse(readFileSync(folder + '/sources.yaml', 'utf8'));
    const files = {};
    for (const language of metadata.languages) files[language + '.md'] = readFileSync(folder + '/' + language + '.md', 'utf8');
    files['variables.schema.json'] = readFileSync(folder + '/variables.schema.json', 'utf8');
    files['sources.yaml'] = readFileSync(folder + '/sources.yaml', 'utf8');
    files['source-records.json'] = JSON.stringify(resolveReviewSourceRecords(declarations.source_ids, registry.sources), null, 2) + '\n';
    files['notes.md'] = readFileSync(folder + '/notes.md', 'utf8');
    files['metadata.json'] = reviewableMetadata(metadata);
    files['CHANGELOG.md'] = readFileSync(folder + '/CHANGELOG.md', 'utf8');
    digests[metadata.id] = digestReviewableContent(files);
  }
}
console.log(JSON.stringify(digests));
"""
        result = subprocess.run([node, "--input-type=module", "-e", script], cwd=server.ROOT, capture_output=True, text=True, timeout=10, check=True)
        expected = {}
        for folder, metadata in server.packages():
            expected[metadata["id"]] = server._reviewable_content_digest(folder, metadata)
        self.assertEqual(expected, json.loads(result.stdout))

    def test_change_history_reads_the_package_changelog_only(self):
        result = server.call("get_change_history", {"template_id": "privacy-policy"})
        self.assertEqual(result["template_version"], "0.1.3")
        self.assertEqual(result["history_source"], "template_changelog")
        self.assertIn("## 0.1.3", result["history"])
        self.assertIn("not independently verified", result["disclaimer"])
        with self.assertRaisesRegex(ValueError, "Unknown or ambiguous"):
            server.call("get_change_history", {"template_id": "missing-template"})
        with self.assertRaisesRegex(ValueError, "requires only"):
            server.call("get_change_history", {"template_id": "privacy-policy", "path": "../../README.md"})

    def test_source_search_and_topic_index_are_local_and_non_certifying(self):
        topics = server.call("list_legal_topics", {})
        self.assertIn("personal-data", [item["id"] for item in topics["topics"]])
        self.assertGreater(topics["topics"][0]["source_count"], 0)
        self.assertIn("not a complete", topics["disclaimer"])

    def test_get_checklist_returns_only_preliminary_counsel_questions(self):
        result = server.call("get_checklist", {"app_type": "saas"})
        self.assertEqual(result["app_type"], "saas")
        self.assertEqual(result["questions"][0]["id"], "operator-and-customer")
        self.assertTrue(all(set(item) == {"id", "topic", "question"} for item in result["questions"]))
        self.assertIn("not a complete checklist", result["disclaimer"])
        self.assertIn("compliance score", result["disclaimer"])
        with self.assertRaisesRegex(ValueError, "app_type must be one of"):
            server.call("get_checklist", {"app_type": "legal_compliance"})
        with self.assertRaisesRegex(ValueError, "requires only app_type"):
            server.call("get_checklist", {"app_type": "website", "company_name": "Example"})

        result = server.call("search_legal_sources", {"query": "CNDP", "topic": "personal-data", "limit": 3})
        self.assertTrue(result["sources"])
        self.assertLessEqual(len(result["sources"]), 3)
        self.assertTrue(all(item["verification_status"] for item in result["sources"]))
        self.assertIn("not a legal conclusion", result["disclaimer"])

    def test_source_search_rejects_invalid_arguments(self):
        for arguments in [
            {"unsupported": "value"},
            {"query": "x" * 121},
            {"limit": True},
            {"limit": 51},
            {"source_type": "unknown"},
            {"source_type": []},
        ]:
            with self.subTest(arguments=arguments), self.assertRaises(ValueError):
                server.call("search_legal_sources", arguments)

    def test_unknown_ids_languages_and_arguments_fail_cleanly(self):
        cases = [
            ("get_template", {"template_id": "../../README.md"}),
            ("get_template", {"template_id": "missing-template"}),
            ("get_template", {"template_id": "privacy-policy", "language": "../../README.md"}),
            ("list_templates", {"language": "es"}),
            ("list_templates", {"unexpected": True}),
            ("get_template", {"template_id": "privacy-policy", "extra": True}),
            ("list_templates", []),
        ]
        for name, arguments in cases:
            with self.subTest(name=name, arguments=arguments):
                with self.assertRaises(ValueError):
                    server.call(name, arguments)

    def test_duplicate_ids_rejected_deterministically(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "templates"
            for group in ("one", "two"):
                package = root / group / "same-id"
                package.mkdir(parents=True)
                (package / "metadata.yaml").write_text(json.dumps({"id": "duplicate", "languages": [], "category": []}), encoding="utf-8")
            with mock.patch.object(server, "TEMPLATES", root):
                with self.assertRaisesRegex(ValueError, "Duplicate template ids"):
                    server.call("list_templates", {})
                with self.assertRaisesRegex(ValueError, "ambiguous"):
                    server.call("get_template", {"template_id": "duplicate"})

    def test_symlinked_content_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "templates"
            package = root / "privacy" / "privacy-policy"
            package.mkdir(parents=True)
            (package / "metadata.yaml").write_text(json.dumps({"id": "privacy-policy", "languages": ["en"], "category": []}), encoding="utf-8")
            outside = Path(tmp) / "outside.md"
            outside.write_text("outside content", encoding="utf-8")
            try:
                (package / "en.md").symlink_to(outside)
            except (OSError, NotImplementedError):
                self.skipTest("symlinks are unavailable on this platform")
            with mock.patch.object(server, "TEMPLATES", root):
                with self.assertRaisesRegex(ValueError, "symbolic link"):
                    server.call("get_template", {"template_id": "privacy-policy"})

    def test_symlinked_package_directory_is_not_read(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "templates"
            root.mkdir()
            external = Path(tmp) / "external-package"
            external.mkdir()
            (external / "metadata.yaml").write_text(json.dumps({"id": "external-template", "languages": [], "category": []}), encoding="utf-8")
            category = root / "privacy"
            category.mkdir()
            try:
                (category / "linked-package").symlink_to(external, target_is_directory=True)
            except (OSError, NotImplementedError):
                self.skipTest("symlinks are unavailable on this platform")
            with mock.patch.object(server, "TEMPLATES", root), contextlib.redirect_stderr(io.StringIO()):
                templates = server.call("list_templates", {})["templates"]
            self.assertEqual(templates, [])

    def test_protocol_handshake_methods_errors_and_notifications(self):
        requests = [
            {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}},
            {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
            {"jsonrpc": "2.0", "method": "notifications/initialized"},
            {"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "list_templates", "arguments": []}},
            {"jsonrpc": "2.0", "id": 4, "method": "unsupported"},
        ]
        stdout = io.StringIO()
        with mock.patch.object(server.sys, "stdin", io.StringIO("\n".join(json.dumps(item) for item in requests) + "\n")), \
             mock.patch.object(server.sys, "stdout", stdout), \
             contextlib.redirect_stderr(io.StringIO()):
            server.main()
        lines = stdout.getvalue().splitlines()
        self.assertEqual(len(lines), 4)
        output = [json.loads(line) for line in lines]
        self.assertEqual(output[0]["result"]["serverInfo"]["name"], "open-legal-morocco")
        self.assertEqual(len(output[1]["result"]["tools"]), 10)
        self.assertTrue(output[2]["result"]["isError"])
        self.assertEqual(output[3]["error"]["code"], -32601)

    def test_protocol_rejects_oversized_message_and_continues(self):
        oversized = '{"jsonrpc":"2.0","id":1,"method":"ping","padding":"' + ("x" * (server.MAX_MESSAGE_CHARS + 10)) + '"}'
        next_request = {"jsonrpc": "2.0", "id": 2, "method": "ping"}
        stdout = io.StringIO()
        with mock.patch.object(server.sys, "stdin", io.StringIO(oversized + "\n" + json.dumps(next_request) + "\n")), \
             mock.patch.object(server.sys, "stdout", stdout), \
             contextlib.redirect_stderr(io.StringIO()):
            server.main()
        output = [json.loads(line) for line in stdout.getvalue().splitlines()]
        self.assertEqual(len(output), 2)
        self.assertEqual(output[0]["error"]["code"], -32700)
        self.assertIn("exceeds", output[0]["error"]["message"])
        self.assertEqual(output[1], {"jsonrpc": "2.0", "id": 2, "result": {}})

    def test_findings_spec_and_validation_use_published_contract(self):
        spec = server.call("get_findings_spec", {})
        self.assertEqual(spec["schema"]["$id"], "https://github.com/BaseWorkers/openlegal-morocco/schemas/findings/1.0.0")
        self.assertEqual(len(spec["taxonomy"]["controls"]), 10)
        document = {
            "schema_version": "1.0.0", "generated_at": "2026-10-09T10:00:00Z",
            "source": {"tool": "test", "version": "1"}, "repository": {"revision": None},
            "verification_limitations": ["No legal review performed."], "findings": [{
                "finding_id": "mcp-001", "finding_type": "technical_observation", "category": "data-handling",
                "priority": "low", "priority_basis": "technical_remediation", "description": "A component emits a diagnostic event.",
                "legal_question": None, "evidence": [{
                    "summary": "The handler emits the event.",
                    "source_reference": {"kind": "repository_file", "path": "src/handler.py", "line_start": 10, "line_end": 10, "content_digest": None},
                    "verification_status": "verified",
                }],
                "affected_resources": [{"type": "file", "identifier": "src/handler.py"}], "legal_references": [],
                "suggested_controls": ["audit_logging"],
                "review_status": {"verification": "verified", "human_review": "not_requested"},
                "confidence": None, "schema_version": "1.0.0",
            }],
        }
        self.assertEqual(server.validate_findings(document), [])
        self.assertEqual(server.call("export_findings", {"document": document}), document)
        session = {}
        initialized = server.response({
            "method": "initialize",
            "params": {"protocolVersion": "2025-06-18"},
        }, session)
        self.assertEqual(initialized["protocolVersion"], "2025-06-18")
        listed = server.response({"method": "tools/list"}, session)
        export_tool = next(tool for tool in listed["tools"] if tool["name"] == "export_findings")
        self.assertEqual(export_tool["outputSchema"]["$id"], spec["schema"]["$id"])
        structured = server.response({
            "method": "tools/call",
            "params": {"name": "export_findings", "arguments": {"document": document}},
        }, session)
        self.assertEqual(structured["structuredContent"], document)
        self.assertEqual(json.loads(structured["content"][0]["text"]), document)
        legacy_session = {}
        self.assertEqual(server.response({
            "method": "initialize",
            "params": {"protocolVersion": "2024-11-05"},
        }, legacy_session)["protocolVersion"], "2024-11-05")
        legacy_tool = next(
            tool for tool in server.response({"method": "tools/list"}, legacy_session)["tools"]
            if tool["name"] == "export_findings"
        )
        self.assertNotIn("outputSchema", legacy_tool)
        legacy_result = server.response({
            "method": "tools/call",
            "params": {"name": "export_findings", "arguments": {"document": document}},
        }, legacy_session)
        self.assertNotIn("structuredContent", legacy_result)
        self.assertEqual(json.loads(legacy_result["content"][0]["text"]), document)
        duplicate = json.loads(json.dumps(document))
        duplicate["findings"].append({**duplicate["findings"][0], "description": "A distinct observation with the same identifier."})
        duplicate_errors = server.validate_findings(duplicate)
        self.assertTrue(any("duplicate finding_id" in error for error in duplicate_errors))
        malformed = {**document, "findings": None}
        with self.assertRaisesRegex(ValueError, "Invalid findings document"):
            server.call("export_findings", {"document": malformed})
        bad = {**document, "findings": [{"finding_id": "x", "suggested_controls": ["vendor_product"]}]}
        with self.assertRaisesRegex(ValueError, "Invalid findings document"):
            server.call("export_findings", {"document": bad})

    def test_mcp_validator_conforms_to_shared_cli_findings_contract_cases(self):
        fixture_path = server.ROOT / "tests" / "fixtures" / "findings-contract.json"
        corpus = json.loads(fixture_path.read_text(encoding="utf-8"))
        for document in corpus["valid_documents"]:
            self.assertEqual(server.validate_findings(document), [])
            self.assertEqual(server.call("export_findings", {"document": document}), document)
        for test_case in corpus["invalid_cases"]:
            invalid = json.loads(json.dumps(corpus["valid_documents"][0]))
            invalid["findings"][0].update(test_case.get("finding_patch", {}))
            if test_case.get("duplicate_first_finding"):
                invalid["findings"].append(json.loads(json.dumps(invalid["findings"][0])))
            with self.subTest(case=test_case["id"]):
                self.assertTrue(server.validate_findings(invalid))

    def test_findings_export_rejects_sensitive_text_and_wrong_priority_basis(self):
        document = {
            "schema_version": "1.0.0", "generated_at": "2026-10-09T10:00:00Z",
            "source": {"tool": "test", "version": "1"}, "repository": {"revision": None},
            "verification_limitations": [], "findings": [{
                "finding_id": "f-1", "finding_type": "technical_observation", "category": "privacy",
                "priority": "high", "priority_basis": "legal_risk", "description": "Contact alice@example.org",
                "legal_question": None, "evidence": [], "affected_resources": [], "legal_references": [],
                "suggested_controls": ["pii_detection"], "review_status": {"verification": "unverified", "human_review": "pending"},
                "confidence": None, "schema_version": "1.0.0",
            }],
        }
        errors = server.validate_findings(document)
        self.assertTrue(any("priority_basis" in error for error in errors))
        self.assertTrue(any("credential, token, or direct email" in error for error in errors))
        sensitive_path = json.loads(json.dumps(document))
        sensitive_path["findings"][0]["description"] = "A handler writes a field to a log."
        sensitive_path["findings"][0]["evidence"] = [{
            "summary": "The handler writes the field.",
            "source_reference": {"kind": "repository_file", "path": "src/handler.py", "line_start": 1, "line_end": 1, "content_digest": None},
            "verification_status": "verified",
        }]
        sensitive_path["findings"][0]["evidence"][0]["source_reference"]["path"] = "private/alice@example.org.log"
        path_errors = server.validate_findings(sensitive_path)
        self.assertTrue(any("$.findings[0].evidence[0].source_reference.path" in error for error in path_errors))


if __name__ == "__main__":
    unittest.main()
