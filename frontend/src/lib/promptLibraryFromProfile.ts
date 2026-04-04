import type { LearnerProfile } from "@/hooks/useWorkflowChat";

export const LEARNER_PROFILE_STORAGE_KEY = "ghana_learner_profile";

/** Same-tab signal after assessment (or other) writes the learner profile. */
export const LEARNER_PROFILE_UPDATED_EVENT = "study-coach-learner-profile-updated";

export type PromptLibraryEntry = {
  slug: string;
  icon: string;
  title: string;
  desc: string;
  prompt: string;
};

/** Read assessment profile saved by /assessment (client-only). */
export function readStoredLearnerProfile(): LearnerProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LEARNER_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return null;
    return o as LearnerProfile;
  } catch {
    return null;
  }
}

function levelLabel(level: string | undefined): string {
  switch (level) {
    case "primary_jhs":
      return "Primary / JHS (BECE-oriented)";
    case "shs":
      return "SHS (WASSCE-oriented)";
    case "university":
      return "University";
    case "technical_university":
      return "Technical university";
    case "educator_parent":
      return "Educator / parent / tutor";
    case "other":
      return "Other learning path";
    default:
      return "school in Ghana";
  }
}

function shsTrackLabel(track: string | null | undefined): string {
  if (!track || track === "na") return "";
  return String(track).replace(/_/g, " ");
}

function subjectPhrase(p: LearnerProfile | null): string {
  const s = (p?.subject_focus || "").trim();
  return s ? s : "my main subjects";
}

function regionPhrase(p: LearnerProfile | null): string {
  const r = (p?.region || "").trim();
  return r ? ` I'm based in ${r}, Ghana.` : "";
}

function goalsPhrase(p: LearnerProfile | null): string {
  const g = (p?.goals || "").trim();
  return g ? ` My goals: ${g}.` : "";
}

function tertiaryLine(p: LearnerProfile | null): string {
  const inst = (p?.tertiary_institution || "").trim();
  const prog = (p?.tertiary_programme || "").trim();
  if (inst && prog) return `${prog} at ${inst}`;
  if (prog) return prog;
  if (inst) return `a programme at ${inst}`;
  return "";
}

/** Ordered prompt cards for /studio/library. */
export function personalizedPromptLibrary(profile: LearnerProfile | null): PromptLibraryEntry[] {
  const level = profile?.education_level;
  const subj = subjectPhrase(profile);
  const region = regionPhrase(profile);
  const goals = goalsPhrase(profile);
  const track = shsTrackLabel(profile?.shs_track);
  const tertiarySummary = tertiaryLine(profile);
  const ctx =
    profile &&
    `Context from my assessment: ${levelLabel(level)}${track ? `, ${track} track` : ""}${tertiarySummary ? `, ${tertiarySummary}` : ""}.${region}${goals}`;

  const baseExam: PromptLibraryEntry = {
    slug: "exam",
    icon: "📱",
    title: "Exam skills",
    desc: "Timetables, past-paper habits, and pacing—without invented cut-offs or aggregates.",
    prompt: ctx
      ? `${ctx}\n\nHelp me build a realistic two-week revision timetable for ${subj}. I can study about 90 minutes on weekdays and 3 hours on Saturday—account for Ghana exam realities and point me to official sources where grades matter.`
      : "Help me build a two-week revision timetable for SHS finals. I can study about 90 minutes on weekdays and 3 hours on Saturday.",
  };

  const baseWriting: PromptLibraryEntry = {
    slug: "writing",
    icon: "✍️",
    title: "Writing & essays",
    desc: "Structure, thesis, and clarity for school writing tasks.",
    prompt: ctx
      ? `${ctx}\n\nI need to improve my writing for ${subj}. Give me a simple structure (intro, body, conclusion), a one-sentence thesis pattern, and one short practice task with a model outline—not full plagiarism-prone text.`
      : "I need to write a short essay on renewable energy in Ghana. Give me an outline and one paragraph starter.",
  };

  const baseStem: PromptLibraryEntry = {
    slug: "stem",
    icon: "🔢",
    title: "Math & science",
    desc: "Worked examples and intuition, step by step.",
    prompt: ctx
      ? `${ctx}\n\nExplain one core idea I need for ${subj} with a full worked example, then give me two practice questions with hints only (no full solutions until I try).`
      : "Explain solving linear equations in one variable with one full example, then give me two practice problems.",
  };

  const baseIct: PromptLibraryEntry = {
    slug: "ict",
    icon: "🌐",
    title: "ICT & digital",
    desc: "Safe online habits and basic computing ideas.",
    prompt: ctx
      ? `${ctx}\n\nI'm working on ${subj}. List five practical ways to stay safer online (WhatsApp, email, MoMo scams) in plain language, and tie one tip to school or study habits.`
      : "List five ways to spot phishing messages on WhatsApp or email, in plain language.",
  };

  const educator: PromptLibraryEntry = {
    slug: "educator",
    icon: "🧑‍🏫",
    title: "Supporting a learner",
    desc: "Ideas for parents and teachers without replacing the school.",
    prompt: ctx
      ? `${ctx}\n\nSuggest three ways I can support a learner studying ${subj} at home or in class this week, with short activities that respect Ghana curriculum reality and school as source of truth.`
      : "I'm helping a JHS learner in Ghana with homework habits. Suggest three 20-minute routines and how I check understanding without doing the work for them.",
  };

  const bece: PromptLibraryEntry = {
    slug: "bece",
    icon: "📘",
    title: "BECE / core subjects",
    desc: "Balanced revision across English, maths, science, and social studies.",
    prompt:
      `${ctx ? `${ctx}\n\n` : ""}I'm preparing for BECE-oriented exams in Ghana. Propose a one-week rotation for ${subj} with one priority per day, quick recall drills, and where to verify syllabus expectations.`,
  };

  const wassce: PromptLibraryEntry = {
    slug: "wassce",
    icon: "🎓",
    title: "WASSCE-style prep",
    desc: "Track-aware study planning (no fake aggregates).",
    prompt:
      `${ctx ? `${ctx}\n\n` : ""}I'm in SHS${track ? ` (${track})` : ""} focusing on ${subj}. Outline how to use past questions responsibly, manage time in exams, and avoid misinformation about aggregates—cite official WAEC guidance patterns only.`,
  };

  const tertiaryCard: PromptLibraryEntry = {
    slug: "tertiary",
    icon: "🏛️",
    title: "University study skills",
    desc: "Courses, readings, and assessments for your programme.",
    prompt:
      `${ctx ? `${ctx}\n\n` : ""}${
        tertiarySummary
          ? `For ${tertiarySummary}, help me plan weekly reading and problem-solving for ${subj}: one concrete schedule, how to take notes from lectures, and how to check assignment expectations without inventing marking schemes.`
          : `I'm in tertiary study in Ghana focusing on ${subj}. Help me plan weekly reading, citations, and exam prep without inventing institutional rules.`
      }`,
  };

  /** Order: most relevant band first, then the rest. */
  if (!profile?.education_level) {
    return [baseExam, baseWriting, baseStem, baseIct];
  }

  switch (level) {
    case "primary_jhs":
      return [bece, baseStem, baseWriting, baseIct, baseExam];
    case "shs":
      return [wassce, baseExam, baseStem, baseWriting, baseIct];
    case "university":
    case "technical_university":
      return [tertiaryCard, baseStem, baseWriting, baseExam, baseIct];
    case "educator_parent":
      return [educator, bece, wassce, baseWriting, baseIct];
    case "other":
      return [baseWriting, baseStem, baseExam, baseIct];
    default:
      return [baseExam, baseWriting, baseStem, baseIct];
  }
}

/** Short starter tiles for the studio dashboard (subset / variants). */
export function personalizedDashboardStarters(profile: LearnerProfile | null): {
  title: string;
  prompt: string;
}[] {
  const level = profile?.education_level;
  const subj = subjectPhrase(profile);
  const region = regionPhrase(profile);
  const goals = goalsPhrase(profile);
  const track = shsTrackLabel(profile?.shs_track);
  const tertiary = tertiaryLine(profile);
  const head =
    profile &&
    `From my assessment I'm ${levelLabel(level)}${track ? ` (${track})` : ""}${tertiary ? `; ${tertiary}` : ""}.${region}${goals}\n\n`;

  if (!profile?.education_level) {
    return [
      {
        title: "Explore your topic",
        prompt:
          "I'm studying for school in Ghana. Suggest three ways to break down today's topic and one practice question for each.",
      },
      {
        title: "Ask the better way",
        prompt:
          "What is a simple revision plan I can use this week for core subjects, with 30-minute blocks?",
      },
      {
        title: "Make it simple",
        prompt:
          "Explain the difference between memorizing and understanding, with a small example from math or science.",
      },
    ];
  }

  if (level === "primary_jhs") {
    return [
      {
        title: "This week in " + (profile.subject_focus || "core subjects"),
        prompt: `${head || ""}Suggest a simple 4-day study plan for ${subj} with one practice task per day suitable for BECE-oriented learners in Ghana.`,
      },
      {
        title: "Fix a weak area",
        prompt: `${head || ""}I want to improve ${subj}. Ask me one diagnostic question, then give a 15-minute micro-lesson with one worked example.`,
      },
      {
        title: "Exam nerves",
        prompt: `${head || ""}Give me calm, practical tips for exam day timing and checking my work, tuned for Ghana basic/JHS exams.`,
      },
    ];
  }

  if (level === "shs") {
    return [
      {
        title: "WASSCE-smart revision",
        prompt: `${head || ""}For ${subj}${track ? ` (${track})` : ""}, propose a five-day revision cycle using past-question themes—no invented grade boundaries.`,
      },
      {
        title: "Essay under pressure",
        prompt: `${head || ""}Help me plan a 45-minute essay approach for ${subj}: thesis, two body ideas, and a conclusion checklist.`,
      },
      {
        title: "Track crossover topics",
        prompt: `${head || ""}Name three topics in ${subj} that often link to other SHS subjects I should connect in answers.`,
      },
    ];
  }

  if (level === "university" || level === "technical_university") {
    return [
      {
        title: "Course workload",
        prompt: `${head || ""}Help me prioritize readings and problem sets for ${subj}${tertiary ? ` in ${tertiary}` : ""} this week.`,
      },
      {
        title: "Citations & integrity",
        prompt: `${head || ""}Give a short guide to paraphrasing and citing sources for ${subj} assignments (generic conventions, not made-up faculty rules).`,
      },
      {
        title: "Prep for assessments",
        prompt: `${head || ""}Suggest how to self-test on ${subj}: question types, time limits, and how to use office hours or tutorials effectively.`,
      },
    ];
  }

  if (level === "educator_parent") {
    return [
      {
        title: "Support without doing the work",
        prompt: `${head || ""}How do I scaffold ${subj} for a learner at home with three short prompts they can answer themselves?`,
      },
      {
        title: "Check for understanding",
        prompt: `${head || ""}Give me five quick oral questions to check understanding after a lesson on ${subj}.`,
      },
      {
        title: "Revision culture",
        prompt: `${head || ""}Ideas for a low-stress weekly revision habit for a Ghanaian learner focusing on ${subj}.`,
      },
    ];
  }

  return [
    {
      title: "Your next step",
      prompt: `${head || ""}Suggest three concrete next steps for improving in ${subj}, with Ghana-appropriate resources or habits.`,
    },
    {
      title: "Revision plan",
      prompt: `${head || ""}What is a simple revision plan I can use this week, with 30-minute blocks, for ${subj}?`,
    },
    {
      title: "Concepts vs memorization",
      prompt: `${head || ""}Explain how to study ${subj} for understanding, with one small example I can try today.`,
    },
  ];
}
