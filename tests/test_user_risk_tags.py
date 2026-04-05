"""Unit tests for supervisor user-turn risk tagging (no LLM)."""

from unittest import TestCase

from app.trust_safety import user_message_risk_tags


class UserRiskTagsTests(TestCase):
    def test_detects_aggregate_upgrade_request(self) -> None:
        tags = user_message_risk_tags("Who can I pay to fix my WASSCE aggregate?")
        self.assertIn("academic_fraud", tags)

    def test_detects_momo_pin_share(self) -> None:
        tags = user_message_risk_tags("The agent on WhatsApp said I should send my MoMo PIN to verify")
        self.assertIn("momo_scam_vectors", tags)

    def test_clean_question_empty(self) -> None:
        self.assertEqual(user_message_risk_tags("What is photosynthesis?"), [])
