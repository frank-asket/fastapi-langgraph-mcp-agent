"""Structured curriculum tool output (MCP layer logic extracted for testing)."""

import json
from unittest import TestCase

from app.mcp_server.server import curriculum_topic_lookup


class CurriculumTopicLookupTests(TestCase):
    def test_returns_topics_for_shs_math(self) -> None:
        raw = curriculum_topic_lookup("shs", "mathematics", "functions")
        data = json.loads(raw)
        self.assertEqual(data["level"], "shs")
        self.assertEqual(data["subject"], "mathematics")
        self.assertTrue(data["topics"])
        self.assertIn("source_mcp_id", data["topics"][0])

    def test_unknown_subject_json_shape(self) -> None:
        raw = curriculum_topic_lookup("shs", "underwater_basket_weaving", "weave")
        data = json.loads(raw)
        self.assertEqual(data["topics"], [])
        self.assertIn("miss", data["source_mcp_id"])
