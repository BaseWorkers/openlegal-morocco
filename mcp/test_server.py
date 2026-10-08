"""Regression tests for the local read-only MCP server."""

import contextlib
import importlib.util
import io
import json
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
        self.assertEqual(len(output[1]["result"]["tools"]), 3)
        self.assertTrue(output[2]["result"]["isError"])
        self.assertEqual(output[3]["error"]["code"], -32601)


if __name__ == "__main__":
    unittest.main()
