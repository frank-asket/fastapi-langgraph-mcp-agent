"""FastMCP server: Ghana-focused education, curriculum context & digital literacy tools."""

import logging
import re
from typing import Any
from urllib.parse import quote

import httpx
import wikipedia
from wikipedia.exceptions import DisambiguationError, PageError

from fastmcp import FastMCP
from fastmcp.server.event_store import EventStore

logger = logging.getLogger(__name__)

mcp = FastMCP("Ghana education & digital literacy MCP")

# --- Ghana education reference (high level; policies change—learners must verify) ----

GHANA_EDUCATION_SECTIONS: dict[str, str] = {
    "pathways": """**Ghana education pathways (overview)**

- **Early & basic education:** Under the **Ghana Education Service (GES)**, many learners move through Kindergarten, **Primary (P1–P6)**, then **Junior High School (JHS1–JHS3)**. Successful completion leads toward **Basic Education Certificate Examination (BECE)** (path and timing follow current GES/WAEC rules).
- **Senior High School (SHS):** Typically **SHS1–SHS3** with **West African Senior School Certificate Examination (WASSCE)** as the common exit exam for university-bound students.
- **TVET & alternative routes:** Technical and vocational pathways are important in Ghana; options and certifications evolve—check **CTVET**, GES, and school guidance offices.
- **Tertiary:** Public universities, technical universities, colleges of education, and private universities each publish their own **admissions criteria**. Cut-offs and protocols change **every year**.

**Always verify** with your **school**, **WAEC**, or the **specific university/college** before making decisions.""",
    "basic": """**Basic education (Ghana contextual notes)**

- **GES** oversees public pre-tertiary education; the **National Council for Curriculum and Assessment (NaCCA)** works on **curriculum and assessment frameworks** used in public schools.
- Core learning areas at basic level commonly emphasize **literacy, numeracy, creative arts, Ghanaian language & culture, science, physical education**, and **religious & moral education**, though exact exposure varies by school and phase.
- **English** is widely used as a language of instruction alongside **Ghanaian languages** that reflect the learner’s context (e.g. Akan varieties, Ewe, Ga, Dagbani, and others depending on region and school).

Use your **scheme of work**, **textbooks** issued or approved for your school, and your **teacher** as the source of truth for what is examinable this term.""",
    "jhs_bece": """**JHS & BECE-oriented notes (Ghana)**

- **BECE** is a key transition exam toward **SHS or TVET placements** in Ghana’s public system context; subjects and formats follow **WAEC** specifications.
- Placement and **Computerized School Selection and Placement System (CSSPS)** rules change—follow **GES** and **WAEC** circulars for the **year you are sitting the exam**.
- Study habits: master **past questions** only after you understand concepts; use official syllabi/specimens where available.

Your **JHS headteacher** and **GES district office** are the best places to confirm current policies.""",
    "shs": """**Senior High School (Ghana SHS context)**

- SHS is typically **three years** with a structured programme (often described informally as **General Science, General Arts, Business, Home Economics, Visual Arts, and related tracks** depending on school—names and combinations evolve).
- Apart from subjects, many schools emphasise **ICT**, **project work**, and **citizenship** aligned with national goals.

Confirm your **exact subject combination** and **assessment weights** with your SHS administration—not with chatbots alone.""",
    "wassce": """**WASSCE (Ghana context)**

- **WASSCE** is administered by **WAEC** for West Africa; in Ghana it is central to **university admissions** together with any additional requirements each institution sets.
- Grading, **aggregates**, **protocols**, and **cut-off points are not stable year-to-year** and differ by programme (Medicine, Law, Engineering, Humanities, etc.).

For your cohort, rely on **WAEC**, **Ghana Tertiary Education Commission (GTEC)** guidance for policy context, and each **university’s admissions brochure**.""",
    "ges_nacca": """**GES & NaCCA — where curriculum lives**

- **Ghana Education Service (GES):** implementation, schools policy, teacher support (operational layer learners see day-to-day).
- **NaCCA:** curriculum standards and assessment frameworks for **pre-tertiary** public education.

Teachers and schools receive official interpretations—when preparing for national exams, prioritize **WAEC syllabus/specimen**, **past questions**, and **school mocks** over informal summaries.""",
    "tvet": """**TVET in Ghana (orientation only)**

- Technical and vocational pathways include **National Technical Institute programmes**, **technical universities**, and **industry certifications**. Naming and entry requirements are updated periodically.

If you are considering **TVET after JHS or SHS**, speak with **GES career guidance**, **CTVET**, or the **specific institute** you are targeting.""",
    "languages_in_schools": """**Languages in Ghanaian schools**

- **English** is the official language of instruction at many levels and is central to **WASSCE** and most tertiary placements.
- **Ghanaian languages** are part of cultural and literacy development; which language you study often depends on **region and school**.
- For **spelling, essays, and oral English**, your English teacher’s rubric wins—use dictionary tools to support vocabulary, not to contradict classroom rules.""",
}

GHANA_DIGITAL_TOPICS: dict[str, str] = {
    "ghana_trusted_sources": """**Finding trustworthy help in Ghana (learners)**

- **Government & agencies:** Prefer **`.gov.gh`** sites, **Ghana Education Service**, **WAEC Ghana**, **NaCCA**, **Ministry of Education** communications, and **Ghana Health Service** for health education—not random Telegram channels.
- **School first:** Homework rules, plagiarism policies, and acceptable sources are set by your **headteacher** and **subject teachers**.
- **News:** Cross-check major stories with **established Ghanaian outlets** and official statements—especially during exams and admissions season when rumours spread fast.
- **Emergencies:** For life-threatening situations, contact **local emergency services**. Save numbers your guardian confirms (common public safety numbers are publicized nationally—verify with your **phone network** or **school**).

Practice: Bookmark **ges.gov.gh**, **waecgh.org**, and your **school portal** if you have one.""",
    "momo_safety_ghana": """**Mobile money (MoMo) safety — Ghana context**

- **Never share your MoMo PIN** or **one-time passwords (OTP)**. Real MTN/Vodafone agents will not DM you for these on WhatsApp.
- **“Wrong transaction” scams:** Strangers claiming they “sent money by mistake” may pressure you—use **official cash-out rules** and **call your network’s official short code** from the number printed on your SIM pack or official app—not from a random screenshot.
- **Fake “MoMo loans” or “cashback” links:** Type **official URLs** or use the **network app**; avoid sideloaded APKs.
- **“School fees” impersonation:** Parents: confirm **school pay-in details** by **calling the school bursar’s known number**, not only WhatsApp forwards.

If you lose money to fraud, note details and report through **your operator’s fraud line** and, where appropriate, **Ghana Police (CID/Cybercrime)** with a trusted adult.""",
    "whatsapp_hoaxes_ghana": """**WhatsApp & TikTok rumours (Ghana classrooms)**

- **“Free laptops / scholarships / fee waivers”** that only appear as forwarded messages are often **false**. Verify on **official .gov.gh**, **university websites**, or **radio press releases**.
- **Old protest videos** are often recycled as “today’s news”—check date and source.
- **Exam “leak” claims** harm everyone and can be **illegal**. Trust **WAEC** statements only.

Practice: If a message pressures you to **forward in 10 groups**, it is almost never trustworthy.""",
}

# Core digital literacy (international baseline) + Ghana extensions merged in lesson tool
DIGITAL_LITERACY_TOPICS: dict[str, str] = {
    "evaluating_sources": """Evaluating online sources (classroom-friendly)

1. **Who published this?** Look for an About page, author credentials, and whether the site is news, a blog, government (.gov.gh in Ghana), education, or sales.
2. **Why was it written?** Inform, persuade, sell, or entertain?
3. **When was it updated?** Old articles mislead on fast-changing topics.
4. **Corroborate** with a second independent source.
Practice: Answer who, why, when for one article.""",
    "password_basics": """Password basics

- Use **unique passwords** per important account; a **password manager** helps.
- Enable **2FA** for email, MoMo-linked email, and school portals when offered.
- Never share **PINs/OTPs**—especially with “agents” in DMs.

Practice: Turn on 2FA on one account with a guardian’s help if you are under 18.""",
    "phishing_awareness": """Phishing (SMS, WhatsApp, email)

- Urgency, threats, and “you won a prize” are red flags.
- Links that **almost** match your bank or school site—inspect carefully.
- Legitimate organizations rarely ask for **PIN + OTP together**.

Pause and ask a **trusted adult** before clicking payment links.""",
    "online_privacy": """Online privacy

- Posts can be **screenshotted**; “delete” is not guaranteed.
- Limit **location** and **contact** sharing on school-age accounts.
- Separate **study persona** from risky personal content.

Review privacy settings with a **teacher or guardian** if unsure.""",
    "media_literacy": """Media literacy

- Read past sensational **headlines**.
- Video clips may be **out of context**—slow down before sharing.
- For national issues, prefer **outlets that issue corrections** and official statements.

Ask: *Would I correct myself publicly if this turned out wrong?*""",
    "finding_help_online": """Finding help online (starts generic; pair with ghana_trusted_sources)

- Prefer **government**, **school**, and **library** portals over anonymous forums.
- For health learning (not diagnosis): use **national health education** pages.
- For **Ghana**, see lesson key **ghana_trusted_sources**.

Bookmark **one official help line** your guardian confirms.""",
    "reading_strategies": """Reading strategies

- **Skim** headings and first/last paragraphs.
- **Chunk** one paragraph at a time; paraphrase aloud in **English or your study language**.
- Look up the **one repeating unknown word** that blocks meaning.

Write **three bullets** of the author’s argument—not endless highlighting.""",
    "app_permissions": """App permissions

- Deny **mic/camera/contacts** unless the app clearly needs them.
- **Location: While using** is enough for maps—avoid “always on” for random apps.
- Remove permissions from **unused** games and modded APKs (avoid sideloading).

Use official **Play Store / App Store** where possible.""",
}

ALL_DIGITAL_TOPICS: dict[str, str] = {**DIGITAL_LITERACY_TOPICS, **GHANA_DIGITAL_TOPICS}

# Curated portals — offerings change; learners must verify freshness on live sites.
GHANA_LEARNING_RESOURCE_SECTIONS: dict[str, str] = {
    "official_pre_tertiary": """**Official & agency sources (JHS, SHS, teachers — Ghana)**

- **NaCCA** — standards-based curriculum, SHS curriculum materials, approved textbook lists: https://nacca.gov.gh/
- **Ministry of Education** — national policy; curriculum microsite for **SHS / SHTS / STEM** context: https://moe.gov.gh/
- **Ghana Education Service (GES)** — schools, circulars, basic & secondary operations: https://ges.gov.gh/
- **National Teaching Council (NTC)** — licensing, professional standards, GTLE-related guidance: https://ntc.gov.gh/
- **WAEC Ghana** — **BECE / WASSCE** registration, syllabi, official exam information: https://www.waecgh.org/

*School scheme of work + teacher instructions beat any third-party summary.*""",
    "textbooks_teacher_guides": """**Textbooks, handbooks & teacher guides**

- **T-TEL Knowledge Hub** — PLC handbooks, SHS/SHTS/STEM resources, assessment toolkits: https://t-tel.org/knowledge-hub/ — **Secondary education** folder: https://t-tel.org/knowledge-hub/secondary-education/
- **College Desk Ghana** — Primary, JHS, SHS textbook & teacher-guide PDFs: https://www.collegedeskgh.info/
- **NNF Esquire** — teacher / facilitator guide downloads: https://www.nnfesquire.com/

*Cross-check editions against **NaCCA** approved lists where applicable.*""",
    "past_questions_platforms": """**Past questions (Pasco), mocks & practice (community)**

Not substitutes for **WAEC** rules or timetables:

- **Passco Ghana** — BECE & WASSCE past papers & mocks: https://passco.com.gh/
- **SyllabusGH** — syllabi-aligned notes, quizzes, Pasco-style prep: https://syllabusgh.com/
- **PASCO4YOU** — interactive WAEC past-question modes: https://www.pasco4you.com/
- **GhLearner** — web / app / WhatsApp-style practice: https://ghlearner.com/

*Study concepts first; avoid “leaked paper” scams — pair with `digital_literacy_lesson` → `whatsapp_hoaxes_ghana`.*""",
    "tertiary": """**University & higher education (Ghana)**

**Regulation**

- **GTEC** — accredited programmes & institutions; **unaccredited** warnings: https://www.gtec.edu.gh/
- **Ministry of Education** — tertiary policy documents (site search “tertiary” / “higher education”): https://moe.gov.gh/

**Major public portals** (fees, cut-offs, calendars change yearly):

- **University of Ghana (UG)**: https://www.ug.edu.gh/
- **KNUST**: https://www.knust.edu.gh/
- **UCC**: https://ucc.edu.gh/
- **UPSA**: https://upsa.edu.gh/

**Libraries & skills**

- **Ghana Library Authority** — e-books, audiobooks, app; **Read2Skill** programmes: https://www.library.gov.gh/
- **Ashesi University** (institution hub, public materials): https://www.ashesi.edu.gh/

**Funding**

- **GETFund**: https://www.getfund.gov.gh/
- **Ghana Scholarship Secretariat**: https://scholarships.gov.gh/ — applications often via https://apply.scholarships.gov.gh/

*Use **GTEC** + each institution’s **official .edu.gh** site; never pay random “clearing agents.”*""",
}

GHANA_UNIVERSITIES: list[tuple[str, str, str]] = [
    ("University of Ghana", "UG", "Greater Accra (Legon) — large comprehensive public university."),
    ("Kwame Nkrumah University of Science and Technology", "KNUST", "Kumasi — science, engineering, technology, architecture."),
    ("University of Cape Coast", "UCC", "Cape Coast — strong education heritage & broad programmes."),
    ("University for Development Studies", "UDS", "Northern Ghana — development-focused multi-campus public university."),
    ("University of Mines and Technology", "UMaT", "Tarkwa — mining, engineering, earth sciences."),
    ("University of Energy and Natural Resources", "UENR", "Sunyani — energy, natural resources, environment."),
    ("University of Health and Allied Sciences", "UHAS", "Volta Region — health professions training."),
    ("Ghana Institute of Management and Public Administration", "GIMPA", "Accra — public admin, business, governance."),
    ("Accra Technical University", "ATU", "Accra — technical & applied programmes."),
    ("Koforidua Technical University", "KTU", "Koforidua — technology-focused programmes."),
    ("Tamale Technical University", "TaTU", "Tamale — technical higher education in the north."),
    ("Ho Technical University", "HTU", "Ho — technical & vocational-oriented degrees."),
    ("Takoradi Technical University", "Takoradi Tech", "Sekondi-Takoradi — engineering & technology."),
    ("Ashesi University", "Ashesi", "Berekuso — private non-profit, liberal arts & STEM ethos."),
    ("Academic City University College", "Academic City", "Accra region — private STEM-oriented institution."),
    ("Central University", "CU", "Accra / campuses — private faith-founded university."),
    ("Presbyterian University", "PUG", "multi-campus — church-related private university."),
    ("University of Professional Studies", "UPSA", "Accra — business, law, public administration."),
]


def _normalize_q(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


@mcp.tool
def ghana_education_overview(section: str) -> str:
    """Official-style orientation for Ghana (GES/SHS/WASSCE/TVET). Sections: pathways, basic, jhs_bece, shs, wassce, ges_nacca, tvet, languages_in_schools."""
    key = section.strip().lower().replace(" ", "_").replace("-", "_")
    aliases = {
        "overview": "pathways",
        "pipeline": "pathways",
        "primary": "basic",
        "jhs": "jhs_bece",
        "bece": "jhs_bece",
        "senior_high": "shs",
        "nacca": "ges_nacca",
        "ges": "ges_nacca",
        "tvet_ctvet": "tvet",
        "languages": "languages_in_schools",
    }
    key = aliases.get(key, key)
    if key not in GHANA_EDUCATION_SECTIONS:
        keys = ", ".join(sorted(GHANA_EDUCATION_SECTIONS))
        return f"No section {section!r}. Valid keys: {keys}."
    return GHANA_EDUCATION_SECTIONS[key]


@mcp.tool
def ghana_learning_resources(section: str) -> str:
    """Curated links: NaCCA/GES/WAEC, textbooks hubs, Pasco-style platforms, tertiary (GTEC, universities, scholarships)."""
    key = section.strip().lower().replace(" ", "_").replace("-", "_")
    aliases = {
        "official": "official_pre_tertiary",
        "government": "official_pre_tertiary",
        "ges": "official_pre_tertiary",
        "nacca": "official_pre_tertiary",
        "jhs": "official_pre_tertiary",
        "shs": "official_pre_tertiary",
        "bece": "past_questions_platforms",
        "wassce": "past_questions_platforms",
        "pasco": "past_questions_platforms",
        "past_questions": "past_questions_platforms",
        "exam_prep": "past_questions_platforms",
        "textbooks": "textbooks_teacher_guides",
        "teacher_guides": "textbooks_teacher_guides",
        "ttel": "textbooks_teacher_guides",
        "university": "tertiary",
        "universities": "tertiary",
        "tertiary": "tertiary",
        "higher_education": "tertiary",
        "gtec": "tertiary",
        "scholarships": "tertiary",
    }
    key = aliases.get(key, key)
    if key not in GHANA_LEARNING_RESOURCE_SECTIONS:
        keys = ", ".join(sorted(GHANA_LEARNING_RESOURCE_SECTIONS))
        return f"No section {section!r}. Keys: {keys}."
    return GHANA_LEARNING_RESOURCE_SECTIONS[key]


@mcp.tool
def ghana_tertiary_snapshot(query: str) -> str:
    """Short orientation about major Ghanaian universities & technical universities (not admissions advice)."""
    qn = _normalize_q(query)
    if not qn:
        return "Provide part of a university name or city (e.g. KNUST, Cape Coast, Tamale Tech)."

    matches: list[str] = []
    for full, abbr, blurb in GHANA_UNIVERSITIES:
        blob = _normalize_q(f"{full} {abbr} {blurb}")
        if qn in blob or any(tok in blob for tok in qn.split() if len(tok) > 2):
            matches.append(f"**{full} ({abbr})** — {blurb}")

    if not matches:
        return (
            f"No quick match for {query!r}. Try: University of Ghana, KNUST, UCC, UDS, UMaT, UENR, UHAS, "
            "GIMPA, Accra Tech (ATU), Ashesi, UPSA.\n"
            "Admissions, cut-offs, and fee schedules **change yearly**—use each institution’s official site."
        )
    return (
        "\n\n".join(matches[:6])
        + "\n\n*Not exhaustive.* For **links** (GTEC, portals, scholarships), call `ghana_learning_resources` with section **tertiary**. "
        "For **cut-offs and deadlines**, use each institution’s live admissions page."
    )


@mcp.tool
def encyclopedia_summary(topic: str) -> str:
    """Short Wikipedia overview—use alongside Ghana curriculum sources; not a replacement for textbooks."""
    try:
        return wikipedia.summary(topic, sentences=4, auto_suggest=True)
    except DisambiguationError as e:
        opts = getattr(e, "options", []) or []
        preview = ", ".join(str(o) for o in opts[:5])
        return f"Several Wikipedia articles match. Try a clearer topic. Examples: {preview}"
    except PageError:
        return f"No Wikipedia page found for {topic!r}."
    except Exception as e:  # noqa: BLE001
        logger.exception("encyclopedia_summary failed")
        return f"Lookup failed: {e}"


@mcp.tool
def dictionary_lookup(word: str) -> str:
    """English dictionary (WASSCE/university English support); classroom spelling may follow British norms."""
    w = word.strip()
    if not w:
        return "Please provide a word."
    url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{quote(w)}"
    try:
        with httpx.Client(timeout=20.0) as client:
            r = client.get(url)
            if r.status_code == 404:
                return f"No entry for {w!r}. Try base form (e.g. 'analyze' vs 'analysed')."
            r.raise_for_status()
            data = r.json()
    except httpx.HTTPError as e:
        logger.exception("dictionary_lookup HTTP failed")
        return f"Dictionary unavailable: {e}"
    except Exception as e:  # noqa: BLE001
        logger.exception("dictionary_lookup failed")
        return f"Lookup failed: {e}"

    if not isinstance(data, list) or not data:
        return f"Unexpected response for {w!r}."

    entry = data[0]
    word_title = entry.get("word", w)
    phonetic = entry.get("phonetic") or ""
    lines: list[str] = [f"Word: {word_title}" + (f" ({phonetic})" if phonetic else "")]

    meanings = entry.get("meanings") or []
    for m in meanings[:3]:
        pos = m.get("partOfSpeech", "")
        defs = m.get("definitions") or []
        for d in defs[:2]:
            text = d.get("definition", "")
            example = d.get("example")
            bit = f"- ({pos}) {text}" if pos else f"- {text}"
            if example:
                bit += f' Example: "{example}"'
            lines.append(bit)
        if len(lines) > 8:
            break

    if len(lines) == 1:
        lines.append("No definitions parsed—try another form.")
    return "\n".join(lines)


def _rest_countries_json(path: str) -> dict[str, Any]:
    url = f"https://restcountries.com/v3.1{path}"
    with httpx.Client(timeout=30.0) as client:
        r = client.get(url)
        r.raise_for_status()
        data = r.json()
        if not isinstance(data, list):
            return {"error": "Unexpected API response", "raw": data}
        return {"countries": data}


@mcp.tool
def country_overview(country_name: str) -> str:
    """Geography / social studies (Ghana & world). Use with Ghana Integrated Science / Social Studies topics."""
    try:
        payload = _rest_countries_json(f"/name/{quote(country_name)}")
    except httpx.HTTPStatusError as e:
        return f"Geography lookup error: HTTP {e.response.status_code}"
    except Exception as e:  # noqa: BLE001
        logger.exception("country_overview failed")
        return f"Request failed: {e}"

    countries = payload.get("countries", [])
    if not countries:
        return f"No country found for {country_name!r}."

    c = countries[0]
    name_common = c.get("name", {}).get("common", country_name)
    official = c.get("name", {}).get("official", "")
    cap = ", ".join(c.get("capital", []) or ["n/a"])
    region = c.get("region", "")
    sub = c.get("subregion", "")
    pop = c.get("population", "")
    langs = list((c.get("languages") or {}).values())[:5]
    lang_s = ", ".join(langs) if langs else "—"

    return (
        f"{name_common} ({official})\n"
        f"- Capital(s): {cap}\n"
        f"- Region: {region}" + (f", {sub}" if sub else "") + f"\n"
        f"- Population (approx.): {pop}\n"
        f"- Languages (sample): {lang_s}\n"
        "REST Countries API — confirm with syllabus maps & GES materials for exams."
    )


@mcp.tool
def currency_learning(currency_code: str) -> str:
    """Economics / geography: ISO currencies; **GHS** is Ghana Cedi — useful for EMS/Social Studies projects."""
    code = currency_code.strip().upper()
    try:
        payload = _rest_countries_json(f"/currency/{quote(code)}")
    except httpx.HTTPStatusError as e:
        return f"Lookup error: HTTP {e.response.status_code}"
    except Exception as e:  # noqa: BLE001
        logger.exception("currency_learning failed")
        return f"Request failed: {e}"

    countries = payload.get("countries", [])
    if not countries:
        return f"No countries for {code!r}. Try GHS, NGN, XOF, USD, EUR."

    names = [c.get("name", {}).get("common", "?") for c in countries[:20]]
    extra = f" …and {len(countries) - 20} more" if len(countries) > 20 else ""
    return f"Countries using {code}: {', '.join(names)}{extra}."


@mcp.tool
def digital_literacy_lesson(topic: str) -> str:
    """Digital life skills. Core keys plus Ghana: ghana_trusted_sources, momo_safety_ghana, whatsapp_hoaxes_ghana."""
    key = topic.strip().lower().replace(" ", "_").replace("-", "_")
    aliases = {
        "sources": "evaluating_sources",
        "passwords": "password_basics",
        "phishing": "phishing_awareness",
        "privacy": "online_privacy",
        "media": "media_literacy",
        "help": "finding_help_online",
        "reading": "reading_strategies",
        "apps": "app_permissions",
        "permissions": "app_permissions",
        "ghana": "ghana_trusted_sources",
        "momo": "momo_safety_ghana",
        "mobile_money": "momo_safety_ghana",
        "whatsapp": "whatsapp_hoaxes_ghana",
        "rumours": "whatsapp_hoaxes_ghana",
        "hoaxes": "whatsapp_hoaxes_ghana",
    }
    key = aliases.get(key, key)
    if key not in ALL_DIGITAL_TOPICS:
        available = ", ".join(sorted(ALL_DIGITAL_TOPICS))
        return f"No lesson for {topic!r}. Keys include: {available}"
    return ALL_DIGITAL_TOPICS[key]


# Shared tail for lane-specific coaches (multi-agent MCP prompts).
_COACH_SHARED = """**Curriculum & admissions**
- Ground explanations in **Ghana’s context** (GES, NaCCA frameworks at a high level, **BECE**, **WASSCE**, SHS programmes, TVET).
- **Policies, aggregates, cut-offs, and fees change every year.** Never invent numbers. Tell students to verify with **their school**, **WAEC Ghana**, **NaCCA/GES circulars**, and the **specific institution’s admissions page**.
- **English** is central to progression; respect that many learners also use **Ghanaian languages** at home—encourage clear expression in the language of instruction their teacher expects.

**Tools (use when helpful)**
- `ghana_education_overview` — pathways & exam context.
- `ghana_learning_resources` — **curated URLs**: NaCCA/GES/WAEC, textbook hubs (T-TEL, College Desk, NNF), Pasco-style sites, **tertiary** (GTEC, UG/KNUST/UCC/UPSA, GhLA, GETFund, Scholarship Secretariat).
- `ghana_tertiary_snapshot` — short blurbs on named universities (pair with `ghana_learning_resources` → tertiary for links).
- `encyclopedia_summary`, `dictionary_lookup`, `country_overview`, `currency_learning` — subject support.
- `digital_literacy_lesson` — includes **Ghana-specific MoMo & WhatsApp hoax** lessons.

**Pedagogy**
- Teach with **short steps**, **examples grounded in Ghana** where natural (cedis contexts, local exams, Accra/Kumasi/Tamale references only when appropriate).
- For homework: offer **hints and methods** first; do not replace the student’s own thinking.
- Cite or summarize **tool output**; if tools fail, suggest **official .gov.gh**, **school staff**, or **library**.

**Safety**
- Not a clinician, lawyer, or crisis professional. For emergencies, direct to **local emergency services**; help the learner involve a **trusted adult** or **school counsellor**.
- Do not facilitate exam malpractice or hate.

If the user’s goal is unclear, ask **one** short question (class level, subject, or exam) before a long answer."""


@mcp.prompt
def common_prompt() -> str:
    """Generalist tutor — Ghana GES, JHS, SHS, TVET, and universities (default lane)."""
    return (
        "You are a **study coach** for learners in **Ghana**: **GES basic & JHS**, **SHS**, **TVET**, "
        "and **Ghanaian universities & technical universities**.\n\n"
        + _COACH_SHARED
    )


@mcp.prompt
def jhs_coach_prompt() -> str:
    """JHS / BECE specialist — curriculum, BECE readiness, age-appropriate explanations."""
    return (
        "You are the **JHS / BECE specialist** for Ghana. Prioritize **Junior High School** learners: "
        "**Common Core Programme**, **BECE** skills, transitions toward SHS/TVET, and **NaCCA/GES** basic–JHS context. "
        "Use **concrete**, encouraging language suitable for younger teens; build **conceptual understanding** before "
        "pushing endless past-paper drill. Tie practice to **WAEC syllabi** and school schemes.\n\n"
        + _COACH_SHARED
    )


@mcp.prompt
def shs_coach_prompt() -> str:
    """SHS / WASSCE specialist — tracks, electives, exam technique."""
    return (
        "You are the **SHS / WASSCE specialist** for Ghana. Prioritize **Senior High School**: programme tracks "
        "(e.g. General Science, General Arts, Business, Visual Arts), **WASSCE** subject demands, and "
        "**university / tertiary awareness** without inventing cut-offs. Stress **exam technique**, time management, "
        "and linking subjects to career curiosity. Prefer official **WAEC** / school sources over rumours.\n\n"
        + _COACH_SHARED
    )


@mcp.prompt
def tertiary_coach_prompt() -> str:
    """Tertiary pathways — GTEC, accreditation, admissions literacy."""
    return (
        "You are the **tertiary pathways coach** for Ghana. Focus on **universities, technical universities, colleges "
        "of education**, **GTEC accreditation**, **official admissions pages**, **GETFund / Scholarship Secretariat** "
        "orientation, and **library / research habits**. Never invent aggregates or fees—always steer users to live "
        "**.edu.gh** sites and **GTEC** lists. Keep tone appropriate for young adults and applicants.\n\n"
        + _COACH_SHARED
    )


@mcp.prompt
def educator_coach_prompt() -> str:
    """Teachers, school leaders, parents — PLC-friendly, policy-aware."""
    return (
        "You support **Ghanaian teachers, school leaders, and parents**. Use **professional, respectful** language; "
        "reference **PLC**, **T-TEL / NaCCA / GES** resources where useful; distinguish **classroom practice** from "
        "what students should hear when simplified. Encourage adherence to **official circulars** and safeguarding norms. "
        "You are not a substitute for **NTC**, labour advice, or school management decisions.\n\n"
        + _COACH_SHARED
    )


def build_event_store(redis_url: str | None = None) -> EventStore:
    """In-memory event store by default; optional Redis when URL is set and redis is installed."""
    import os

    redis_url = redis_url or os.environ.get("REDIS_URL")
    if not redis_url:
        return EventStore()

    try:
        from key_value.aio.stores.redis import RedisStore
    except ImportError:
        logger.warning(
            "REDIS_URL set but Redis backend unavailable; install redis package. Using in-memory EventStore."
        )
        return EventStore()

    try:
        backend = RedisStore(url=redis_url)
        return EventStore(storage=backend)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to create Redis EventStore; falling back to memory")
        return EventStore()
