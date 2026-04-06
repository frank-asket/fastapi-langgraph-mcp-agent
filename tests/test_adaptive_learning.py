"""Adaptive learning bandit store and policy (no LLM)."""

import tempfile
from pathlib import Path
from unittest import TestCase

from app.adaptive_learning import apply_learning_feedback, prepare_pedagogy_for_turn, state_bucket
from app.adaptive_learning_store import get_bandit_row, get_thread_last_arm
from app.config import Settings
from app.schemas import LearnerProfile


class AdaptiveLearningTests(TestCase):
    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp()) / "al.db"
        self.settings = Settings(
            adaptive_learning_enabled=True,
            adaptive_learning_db_path=str(self.tmp),
        )

    def test_prepare_sets_thread_arm(self) -> None:
        prof = LearnerProfile(education_level="shs", subject_focus="Math")
        prefix, arm = prepare_pedagogy_for_turn(
            self.settings,
            owner_id="u1",
            thread_id="thread-aaaa-bbbb",
            agent_lane="shs",
            profile=prof,
            coaching_mode="full",
        )
        self.assertIsNotNone(arm)
        if arm and arm != "full":
            self.assertIn("Adaptive pedagogy", prefix)
        last = get_thread_last_arm(self.tmp, "thread-aaaa-bbbb", "u1")
        self.assertIsNotNone(last)
        assert last is not None
        self.assertEqual(last[0], state_bucket("shs", prof))

    def test_feedback_updates_bandit(self) -> None:
        prof = LearnerProfile(education_level="jhs", subject_focus="English")
        bucket = state_bucket("general", prof)
        prepare_pedagogy_for_turn(
            self.settings,
            owner_id="u2",
            thread_id="thread-cccc-dddd",
            agent_lane="general",
            profile=prof,
            coaching_mode="full",
        )
        last = get_thread_last_arm(self.tmp, "thread-cccc-dddd", "u2")
        assert last is not None
        arm = last[1]
        ok = apply_learning_feedback(self.settings, "u2", "thread-cccc-dddd", helpful=True)
        self.assertTrue(ok)
        s, f = get_bandit_row(self.tmp, "u2", bucket, arm)
        self.assertEqual(s, 1)
        self.assertEqual(f, 0)
        self.assertIsNone(get_thread_last_arm(self.tmp, "thread-cccc-dddd", "u2"))

    def test_disabled_skips_prefix(self) -> None:
        off = Settings(adaptive_learning_enabled=False, adaptive_learning_db_path=str(self.tmp))
        prefix, arm = prepare_pedagogy_for_turn(
            off,
            owner_id="u3",
            thread_id="t1",
            agent_lane="general",
            profile=None,
            coaching_mode="full",
        )
        self.assertEqual(prefix, "")
        self.assertIsNone(arm)
