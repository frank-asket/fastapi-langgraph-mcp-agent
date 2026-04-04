"""Regression tests for CORS origin list vs STUDY_COACH_FRONTEND_URL."""

from unittest import TestCase

from app.config import Settings


class CorsOriginListTests(TestCase):
    def test_empty_cors_origins_returns_empty_despite_frontend_url(self) -> None:
        s = Settings(
            cors_origins="",
            study_coach_frontend_url="https://study.example.com",
        )
        self.assertEqual(s.cors_origin_list, [])

    def test_whitespace_only_cors_origins_returns_empty_despite_frontend_url(self) -> None:
        s = Settings(
            cors_origins="  \t\n  ",
            study_coach_frontend_url="https://study.example.com",
        )
        self.assertEqual(s.cors_origin_list, [])

    def test_non_empty_cors_merges_study_coach_frontend_url(self) -> None:
        s = Settings(
            cors_origins="https://allowed.example.com",
            study_coach_frontend_url="https://study.example.com",
        )
        self.assertEqual(
            set(s.cors_origin_list),
            {"https://allowed.example.com", "https://study.example.com"},
        )

    def test_non_empty_cors_dedupes_frontend_when_already_listed(self) -> None:
        s = Settings(
            cors_origins="https://study.example.com,https://other.example.com",
            study_coach_frontend_url="https://study.example.com",
        )
        self.assertEqual(
            s.cors_origin_list,
            ["https://study.example.com", "https://other.example.com"],
        )
