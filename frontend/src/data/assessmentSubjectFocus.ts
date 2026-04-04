/**
 * Subject / theme options for the assessment step "What do you want to work on most?"
 * Choices depend on education path (SHS track, tertiary programme name heuristics, etc.).
 */

export type SubjectFocusPath = {
  educationLevel: string | null;
  shsTrack: string;
  tertiaryProgrammeName: string | null;
};

export type SubjectFocusOption = { value: string; label: string };

const SELECT_PLACEHOLDER: SubjectFocusOption = { value: "", label: "Select…" };

function opts(...items: SubjectFocusOption[]): SubjectFocusOption[] {
  return [SELECT_PLACEHOLDER, ...items, { value: "other", label: "Other — I’ll say more in chat" }];
}

const PRIMARY_JHS: SubjectFocusOption[] = [
  { value: "mathematics", label: "Mathematics" },
  { value: "english", label: "English language" },
  { value: "science", label: "Integrated science" },
  { value: "social_studies", label: "Social studies" },
  { value: "ict", label: "ICT / computing basics" },
  { value: "rme", label: "RME / citizenship" },
  { value: "national_language", label: "Ghanaian language" },
];

const SHS_SCIENCE: SubjectFocusOption[] = [
  { value: "core_mathematics", label: "Core mathematics" },
  { value: "elective_mathematics", label: "Elective mathematics" },
  { value: "physics", label: "Physics" },
  { value: "chemistry", label: "Chemistry" },
  { value: "biology", label: "Biology" },
  { value: "english", label: "English language" },
  { value: "elective_lit_french", label: "Elective (Literature / French / other)" },
];

const SHS_ARTS: SubjectFocusOption[] = [
  { value: "english", label: "English language" },
  { value: "literature", label: "Literature in English" },
  { value: "government", label: "Government" },
  { value: "economics", label: "Economics" },
  { value: "history", label: "History" },
  { value: "geography", label: "Geography" },
  { value: "core_mathematics", label: "Core mathematics" },
  { value: "french", label: "French / Ghanaian language" },
];

const SHS_BUSINESS: SubjectFocusOption[] = [
  { value: "core_mathematics", label: "Core mathematics" },
  { value: "financial_accounting", label: "Financial accounting" },
  { value: "cost_accounting", label: "Cost accounting / management" },
  { value: "business_management", label: "Business management" },
  { value: "economics", label: "Economics" },
  { value: "english", label: "English language" },
];

const SHS_HOME_ECON: SubjectFocusOption[] = [
  { value: "management_living", label: "Management in living" },
  { value: "food_nutrition", label: "Food & nutrition" },
  { value: "economics", label: "Economics" },
  { value: "biology", label: "Biology" },
  { value: "core_mathematics", label: "Core mathematics" },
  { value: "english", label: "English language" },
];

const SHS_VISUAL_ARTS: SubjectFocusOption[] = [
  { value: "general_knowledge_art", label: "General knowledge in art" },
  { value: "textiles", label: "Textiles" },
  { value: "graphic_design", label: "Graphic design" },
  { value: "picture_making", label: "Picture making" },
  { value: "core_mathematics", label: "Core mathematics" },
  { value: "english", label: "English language" },
];

const SHS_AGRIC: SubjectFocusOption[] = [
  { value: "general_agriculture", label: "General agriculture" },
  { value: "animal_husbandry", label: "Animal husbandry" },
  { value: "crop_husbandry", label: "Crop husbandry" },
  { value: "chemistry", label: "Chemistry" },
  { value: "biology", label: "Biology" },
  { value: "core_mathematics", label: "Core mathematics" },
  { value: "english", label: "English language" },
];

const SHS_TECH: SubjectFocusOption[] = [
  { value: "technical_drawing", label: "Technical drawing" },
  { value: "mathematics_technical", label: "Mathematics (technical)" },
  { value: "physics", label: "Physics" },
  { value: "chemistry", label: "Chemistry" },
  { value: "applied_electricity", label: "Applied electricity / electronics" },
  { value: "metalwork_woodwork", label: "Metalwork / woodwork" },
  { value: "english", label: "English language" },
];

const TERTIARY_STEM: SubjectFocusOption[] = [
  { value: "core_courses", label: "Core programme modules" },
  { value: "math_stats", label: "Mathematics / statistics" },
  { value: "programming", label: "Programming & algorithms" },
  { value: "labs_projects", label: "Labs, projects & reports" },
  { value: "internship_prep", label: "Internship / industry prep" },
];

const TERTIARY_HEALTH: SubjectFocusOption[] = [
  { value: "pre_clinical", label: "Pre-clinical sciences" },
  { value: "clinical_skills", label: "Clinical skills & OSCE-style prep" },
  { value: "anatomy_physio", label: "Anatomy / physiology" },
  { value: "research_methods", label: "Research / evidence-based practice" },
];

const TERTIARY_LAW: SubjectFocusOption[] = [
  { value: "core_law", label: "Core law courses" },
  { value: "legal_methods", label: "Legal methods & reasoning" },
  { value: "moot_memo", label: "Moot courts / memos" },
];

const TERTIARY_BUSINESS: SubjectFocusOption[] = [
  { value: "finance_accounting", label: "Finance & accounting" },
  { value: "marketing", label: "Marketing & strategy" },
  { value: "econometrics", label: "Econometrics / data" },
  { value: "group_projects", label: "Group projects & presentations" },
];

const TERTIARY_EDUCATION: SubjectFocusOption[] = [
  { value: "pedagogy", label: "Pedagogy & curriculum" },
  { value: "assessment", label: "Assessment & classroom practice" },
  { value: "subject_methods", label: "Subject teaching methods" },
];

const TERTIARY_GENERAL: SubjectFocusOption[] = [
  { value: "core_major", label: "Core courses in my major" },
  { value: "writing_research", label: "Academic writing & research" },
  { value: "exams_time", label: "Exam technique & time management" },
  { value: "career_path", label: "Career / further study planning" },
];

const EDUCATOR_PARENT: SubjectFocusOption[] = [
  { value: "child_study_plan", label: "Helping a child build a study plan" },
  { value: "ges_wassce", label: "Understanding GES / SHS / WASSCE pathways" },
  { value: "past_questions", label: "Past questions & marking schemes" },
  { value: "reading_numeracy", label: "Reading or numeracy support" },
];

const OTHER_PATH: SubjectFocusOption[] = [
  { value: "literacy_numeracy", label: "Literacy & numeracy" },
  { value: "exam_prep", label: "Exam preparation (any level)" },
  { value: "study_skills", label: "Study skills & habits" },
  { value: "digital_skills", label: "Digital skills & safety" },
];

function tertiaryBucket(programmeName: string | null): SubjectFocusOption[] {
  if (!programmeName) return TERTIARY_GENERAL;
  const n = programmeName.toLowerCase();
  if (/\b(law|llb|legal)\b/.test(n)) return TERTIARY_LAW;
  if (/\b(medic|nurs|pharm|dental|midwi|health|biomed|public health)\b/.test(n)) return TERTIARY_HEALTH;
  if (/\b(account|finance|bank|marketing|business|commerce|mba|economics)\b/.test(n)) return TERTIARY_BUSINESS;
  if (/\b(education|b\.ed|teaching)\b/.test(n)) return TERTIARY_EDUCATION;
  if (
    /\b(engineer|computer|software|information techn|data scien|physics|math|chemistry|statistic)\b/.test(n)
  ) {
    return TERTIARY_STEM;
  }
  return TERTIARY_GENERAL;
}

function shsOptions(track: string): SubjectFocusOption[] {
  switch (track) {
    case "science":
      return SHS_SCIENCE;
    case "general_arts":
      return SHS_ARTS;
    case "business":
      return SHS_BUSINESS;
    case "home_economics":
      return SHS_HOME_ECON;
    case "visual_arts":
      return SHS_VISUAL_ARTS;
    case "agricultural":
      return SHS_AGRIC;
    case "technical":
      return SHS_TECH;
    default:
      return [
        { value: "core_mathematics", label: "Core mathematics" },
        { value: "english", label: "English language" },
        { value: "integrated_science", label: "Integrated science / electives" },
      ];
  }
}

/**
 * Returns select options for the subject-focus step (~step 2). First entry is always "Select…".
 */
export function subjectFocusOptionsForPath(path: SubjectFocusPath): SubjectFocusOption[] {
  const { educationLevel, shsTrack, tertiaryProgrammeName } = path;

  if (!educationLevel) {
    return opts(...OTHER_PATH);
  }

  switch (educationLevel) {
    case "primary_jhs":
      return opts(...PRIMARY_JHS);
    case "shs":
      return opts(...shsOptions(shsTrack));
    case "university":
    case "technical_university":
      return opts(...tertiaryBucket(tertiaryProgrammeName));
    case "educator_parent":
      return opts(...EDUCATOR_PARENT);
    case "other":
    default:
      return opts(...OTHER_PATH);
  }
}
