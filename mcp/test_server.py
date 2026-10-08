"""Minimal no-dependency regression tests for the local MCP server."""
import importlib.util
import json
from pathlib import Path
import unittest

SERVER = Path(__file__).with_name("server.py")
spec = importlib.util.spec_from_file_location("openlegal_mcp_server", SERVER)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class MCPTests(unittest.TestCase):
    def test_catalogue_has_draft_disclaimer(self):
        result = mod.call("list_templates", {})
        self.assertIn("not legal advice", result["disclaimer"])
        self.assertGreater(len(result["templates"]), 0)
        for item in result["templates"]:
            self.assertIn("status", item)
            self.assertIn("legal_review", item)

    def test_cannot_access_other_paths(self):
        with self.assertRaises(ValueError):
            mod.call("get_template", {"template_id": "../../README", "language": "en"})
        with self.assertRaises(ValueError):
            mod.call("get_template", {"template_id": "privacy-policy", "language": "../../README"})

    def test_sources_and_content(self):
        sources = mod.call("get_template_sources", {"template_id": "privacy-policy"})
        self.assertEqual(sources["template_id"], "privacy-policy")
        result = mod.call("get_template", {"template_id": "privacy-policy", "language": "ar"})
        self.assertEqual(result["language"], "ar")
        self.assertIn("disclaimer", result)

    def test_mcp_handshake(self):
        self.assertIn("tools", mod.response({"method": "tools/list"}) )
        self.assertEqual(mod.response({"method": "initialize"})["serverInfo"]["name"], "openlegal-morocco")

if __name__ == "__main__":
    unittest.main()
