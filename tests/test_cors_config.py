"""Regression tests for CORS origin list vs STUDY_COACH_FRONTEND_URL."""

from unittest import TestCase

from app.config import Settings

# Isolate from repo .env CLERK_AUTHORIZED_PARTIES (merged into CORS allowlist).
_NO_CLERK_PARTIES = {"clerk_authorized_parties": ""}


class CorsOriginListTests(TestCase):
    def test_empty_cors_origins_uses_study_coach_frontend_url(self) -> None:
        s = Settings(
            **_NO_CLERK_PARTIES,
            cors_origins="",
            study_coach_frontend_url="https://study.example.com",
        )
        self.assertEqual(s.cors_origin_list, ["https://study.example.com"])

    def test_empty_cors_clerk_parties_only(self) -> None:
        s = Settings(
            cors_origins="",
            study_coach_frontend_url=None,
            clerk_authorized_parties="https://study.example.com",
        )
        self.assertEqual(s.cors_origin_list, ["https://study.example.com"])

    def test_whitespace_only_cors_origins_uses_study_coach_frontend_url(self) -> None:
        s = Settings(
            **_NO_CLERK_PARTIES,
            cors_origins="  \t\n  ",
            study_coach_frontend_url="https://study.example.com",
        )
        self.assertEqual(s.cors_origin_list, ["https://study.example.com"])

    def test_empty_cors_and_no_frontend_url_disables_cors(self) -> None:
        s = Settings(**_NO_CLERK_PARTIES, cors_origins="", study_coach_frontend_url=None)
        self.assertEqual(s.cors_origin_list, [])

    def test_non_empty_cors_merges_study_coach_frontend_url(self) -> None:
        s = Settings(
            **_NO_CLERK_PARTIES,
            cors_origins="https://allowed.example.com",
            study_coach_frontend_url="https://study.example.com",
        )
        self.assertEqual(
            set(s.cors_origin_list),
            {"https://allowed.example.com", "https://study.example.com"},
        )

    def test_clerk_authorized_parties_merged_when_cors_explicit(self) -> None:
        s = Settings(
            cors_origins="http://localhost:3000",
            clerk_authorized_parties="https://study.klingbo.com",  # overrides .env
        )
        self.assertEqual(
            set(s.cors_origin_list),
            {"http://localhost:3000", "https://study.klingbo.com"},
        )

    def test_non_empty_cors_dedupes_frontend_when_already_listed(self) -> None:
        s = Settings(
            **_NO_CLERK_PARTIES,
            cors_origins="https://study.example.com,https://other.example.com",
            study_coach_frontend_url="https://study.example.com",
        )
        self.assertEqual(
            s.cors_origin_list,
            ["https://study.example.com", "https://other.example.com"],
        )

    def test_cors_origin_regex_stripped(self) -> None:
        s = Settings(**_NO_CLERK_PARTIES, cors_origin_regex="  ^https://study\\.example\\.com$  ")
        self.assertEqual(s.cors_allow_origin_regex, "^https://study\\.example\\.com$")

    def test_cors_origin_regex_none_when_empty(self) -> None:
        s = Settings(**_NO_CLERK_PARTIES, cors_origin_regex="  \t  ")
        self.assertIsNone(s.cors_allow_origin_regex)
