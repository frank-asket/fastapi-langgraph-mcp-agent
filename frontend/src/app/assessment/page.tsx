"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { subjectFocusOptionsForPath } from "@/data/assessmentSubjectFocus";
import { LEARNER_PROFILE_UPDATED_EVENT } from "@/lib/promptLibraryFromProfile";
import type { GtecInstitution, GtecPayload } from "@/types/gtec";

const STEPS = 5;
const GTEC_DATA_URL = "/data/gtec_tertiary.json";

function programmeComboKey(instId: string, programmeIndex: number): string {
  return `${instId}|${programmeIndex}`;
}

function parseProgrammeCombo(key: string): { instId: string; programmeIndex: number } | null {
  const i = key.lastIndexOf("|");
  if (i <= 0) return null;
  const instId = key.slice(0, i);
  const n = parseInt(key.slice(i + 1), 10);
  if (!instId || Number.isNaN(n)) return null;
  return { instId, programmeIndex: n };
}

export default function AssessmentPage() {
  const [gtec, setGtec] = useState<GtecPayload | null>(null);
  const [gtecErr, setGtecErr] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [educationLevel, setEducationLevel] = useState<string | null>(null);
  const [shsTrack, setShsTrack] = useState("");
  const [tertiaryInstitutionId, setTertiaryInstitutionId] = useState("");
  const [tertiaryProgrammeKey, setTertiaryProgrammeKey] = useState("");
  const [subjectFocus, setSubjectFocus] = useState("");
  const [region, setRegion] = useState("");
  const [goals, setGoals] = useState("");
  const [err0, setErr0] = useState(false);
  const [err1, setErr1] = useState(false);
  const [err2, setErr2] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(GTEC_DATA_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as GtecPayload;
        if (!cancelled) setGtec(data);
      } catch (e) {
        if (!cancelled)
          setGtecErr(e instanceof Error ? e.message : "Could not load GTEC programme list.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tertiaryInstitutions: GtecInstitution[] = useMemo(() => {
    if (!gtec || !educationLevel) return [];
    if (educationLevel === "university")
      return [...gtec.categories.university].sort((a, b) => a.name.localeCompare(b.name));
    if (educationLevel === "technical_university")
      return [...gtec.categories.technical_university].sort((a, b) => a.name.localeCompare(b.name));
    return [];
  }, [gtec, educationLevel]);

  const sortedProgrammeEntries = useMemo(() => {
    const inst = tertiaryInstitutions.find((x) => x.id === tertiaryInstitutionId);
    if (!inst) return [];
    return [...inst.programmes]
      .map((p, originalIndex) => ({ p, originalIndex }))
      .sort((a, b) => a.p.name.localeCompare(b.p.name));
  }, [tertiaryInstitutions, tertiaryInstitutionId]);

  const selectedTertiaryProgrammeName = useMemo(() => {
    const parsed = parseProgrammeCombo(tertiaryProgrammeKey);
    if (!parsed) return null;
    const inst = tertiaryInstitutions.find((x) => x.id === parsed.instId);
    const row = inst?.programmes[parsed.programmeIndex];
    return row?.name?.trim() || null;
  }, [tertiaryProgrammeKey, tertiaryInstitutions]);

  const subjectOptions = useMemo(
    () =>
      subjectFocusOptionsForPath({
        educationLevel,
        shsTrack,
        tertiaryProgrammeName: selectedTertiaryProgrammeName,
      }),
    [educationLevel, shsTrack, selectedTertiaryProgrammeName],
  );

  useEffect(() => {
    if (subjectFocus && !subjectOptions.some((o) => o.value === subjectFocus)) {
      setSubjectFocus("");
    }
  }, [subjectFocus, subjectOptions]);

  const progressPct = useMemo(() => ((step + 1) / STEPS) * 100, [step]);

  const validate = useCallback(() => {
    if (step === 0) {
      setErr0(!educationLevel);
      return !!educationLevel;
    }
    if (step === 1) {
      if (educationLevel === "shs") {
        const ok = !!shsTrack;
        setErr1(!ok);
        return ok;
      }
      if (educationLevel === "university" || educationLevel === "technical_university") {
        const parsed = parseProgrammeCombo(tertiaryProgrammeKey);
        const inst = parsed ? tertiaryInstitutions.find((x) => x.id === parsed.instId) : undefined;
        const ok = !!(
          tertiaryInstitutionId &&
          parsed &&
          inst &&
          parsed.programmeIndex >= 0 &&
          parsed.programmeIndex < inst.programmes.length
        );
        setErr1(!ok);
        return ok;
      }
      setErr1(false);
      return true;
    }
    if (step === 2) {
      setErr2(!subjectFocus);
      return !!subjectFocus;
    }
    return true;
  }, [
    step,
    educationLevel,
    shsTrack,
    tertiaryInstitutionId,
    tertiaryProgrammeKey,
    tertiaryInstitutions,
    subjectFocus,
  ]);

  const finish = useCallback(() => {
    if (!educationLevel) {
      setStep(0);
      setErr0(true);
      return;
    }
    let tertiaryInstitution: string | null = null;
    let tertiaryProgramme: string | null = null;
    if (educationLevel === "university" || educationLevel === "technical_university") {
      const parsed = parseProgrammeCombo(tertiaryProgrammeKey);
      const inst = parsed
        ? tertiaryInstitutions.find((x) => x.id === parsed.instId)
        : tertiaryInstitutions.find((x) => x.id === tertiaryInstitutionId);
      const row =
        inst && parsed
          ? inst.programmes[parsed.programmeIndex]
          : undefined;
      if (inst && row) {
        tertiaryInstitution = inst.name;
        const yrs =
          row.duration_years != null && !Number.isNaN(Number(row.duration_years))
            ? `${row.duration_years} yr`
            : null;
        const st = row.status && row.status !== "Active" ? ` — ${row.status}` : "";
        tertiaryProgramme = yrs ? `${row.name} (${yrs})${st}` : `${row.name}${st}`;
      }
    }
    const profile = {
      education_level: educationLevel,
      shs_track: educationLevel === "shs" ? shsTrack : "na",
      tertiary_institution: tertiaryInstitution,
      tertiary_programme: tertiaryProgramme,
      subject_focus: subjectFocus || null,
      region: region.trim() || null,
      goals: goals.trim() || null,
    };
    try {
      const uuid = crypto.randomUUID();
      localStorage.setItem("ghana_study_thread_id", uuid);
      localStorage.setItem("ghana_learner_profile", JSON.stringify(profile));
      try {
        window.dispatchEvent(new Event(LEARNER_PROFILE_UPDATED_EVENT));
      } catch {
        /* ignore */
      }
      sessionStorage.setItem("ghana_show_assessment_welcome", "1");
    } catch {
      alert("Could not save in this browser.");
      return;
    }
    window.location.href = "/studio/chat";
  }, [
    educationLevel,
    shsTrack,
    tertiaryInstitutionId,
    tertiaryProgrammeKey,
    tertiaryInstitutions,
    subjectFocus,
    region,
    goals,
  ]);

  const onNext = () => {
    if (!validate()) return;
    if (step >= STEPS - 1) {
      finish();
      return;
    }
    setStep((s) => s + 1);
    setErr0(false);
    setErr1(false);
    setErr2(false);
  };

  const onBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const resetTertiary = () => {
    setTertiaryInstitutionId("");
    setTertiaryProgrammeKey("");
  };

  const tertiaryNeedsData =
    step === 1 && (educationLevel === "university" || educationLevel === "technical_university");

  return (
    <div className="min-h-dvh bg-[#f3efe6] px-4 py-6 pb-[max(1.75rem,env(safe-area-inset-bottom,0px))] pt-[max(1.25rem,env(safe-area-inset-top,0px))] text-[#152119] sm:py-7">
      <div className="mx-auto max-w-[520px] pb-12">
        <div className="mb-4">
          <Link href="/" className="text-sm font-semibold text-[#9a7b1a] hover:underline">
            ← Home
          </Link>
        </div>
        <h1 className="font-[family-name:var(--font-syne)] text-2xl font-bold tracking-tight text-[#1b3d30]">
          Learning assessment
        </h1>
        <p className="mt-1 text-[0.95rem] text-[#5c6b62]">
          Five quick steps to shape how Study Coach explains—aligned to your level and programme. Not for grading.
        </p>
        <div className="mb-6 mt-5 h-1 overflow-hidden rounded-full bg-[#dcd3c2]">
          <div className="h-full bg-[#1b3d30] transition-[width] duration-300" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="rounded-2xl border border-[#dcd3c2] bg-[#fffcf7] p-5 shadow-[0_10px_36px_rgba(21,33,25,0.06)]">
          {step === 0 && (
            <StepBlock title="Where are you in school?">
              {err0 && <p className="mb-3 text-sm text-[#a61f3b]">Choose one option.</p>}
              <fieldset className="space-y-2 border-0 p-0">
                {[
                  ["primary_jhs", "Primary / JHS (including BECE years)"],
                  ["shs", "Senior High School (SHS)"],
                  ["university", "University (degree programmes)"],
                  ["technical_university", "Technical university"],
                  ["educator_parent", "Teacher, parent, or tutor helping a learner"],
                  ["other", "Other / not listed"],
                ].map(([value, label]) => (
                  <label key={value} className="flex cursor-pointer items-start gap-2 text-[0.95rem]">
                    <input
                      type="radio"
                      name="education_level"
                      value={value}
                      checked={educationLevel === value}
                      onChange={() => {
                        setEducationLevel(value);
                        resetTertiary();
                        setShsTrack("");
                      }}
                      className="mt-1"
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
            </StepBlock>
          )}

          {step === 1 && educationLevel === "shs" && (
            <StepBlock title="Programme (if it applies)">
              {err1 && <p className="mb-3 text-sm text-[#a61f3b]">Choose your SHS track or closest match.</p>}
              <label className="mb-1 block text-[0.82rem] font-semibold text-[#5c6b62]">SHS track or closest match</label>
              <select
                id="shs_track"
                value={shsTrack}
                onChange={(e) => setShsTrack(e.target.value)}
                className="mb-3 w-full rounded-[10px] border border-[#dcd3c2] bg-white p-2.5 font-inherit"
              >
                <option value="">Select…</option>
                <option value="science">General Science</option>
                <option value="general_arts">General Arts</option>
                <option value="business">Business</option>
                <option value="home_economics">Home Economics</option>
                <option value="visual_arts">Visual Arts</option>
                <option value="agricultural">Agricultural Science</option>
                <option value="technical">Technical</option>
              </select>
              <p className="mb-0 text-sm text-[#5c6b62]">Closest match is fine — your coach will clarify in chat.</p>
            </StepBlock>
          )}

          {tertiaryNeedsData && !gtec && !gtecErr && (
            <StepBlock title="Programme (if it applies)">
              <p className="text-sm text-[#5c6b62]">Loading accredited programme directory…</p>
            </StepBlock>
          )}

          {tertiaryNeedsData && gtecErr && (
            <StepBlock title="Programme (if it applies)">
              <p className="text-sm text-[#a61f3b]">
                Could not load programme data ({gtecErr}). Refresh the page or run{" "}
                <code className="rounded bg-[#eee] px-1 text-xs">scripts/merge_gtec_csv.py</code> to generate{" "}
                <code className="rounded bg-[#eee] px-1 text-xs">public/data/gtec_tertiary.json</code>.
              </p>
            </StepBlock>
          )}

          {step === 1 && (educationLevel === "university" || educationLevel === "technical_university") && gtec && (
            <StepBlock title="Programme (if it applies)">
              {err1 && (
                <p className="mb-3 text-sm text-[#a61f3b]">Choose your institution and accredited programme from the list.</p>
              )}
              <label className="mb-1 block text-[0.82rem] font-semibold text-[#5c6b62]">
                {educationLevel === "university" ? "University" : "Technical university"}
              </label>
              <select
                id="tertiary_institution"
                value={tertiaryInstitutionId}
                onChange={(e) => {
                  setTertiaryInstitutionId(e.target.value);
                  setTertiaryProgrammeKey("");
                }}
                className="mb-3 w-full rounded-[10px] border border-[#dcd3c2] bg-white p-2.5 font-inherit"
              >
                <option value="">Select institution…</option>
                {tertiaryInstitutions.map((ins) => (
                  <option key={ins.id} value={ins.id}>
                    {ins.name}
                  </option>
                ))}
              </select>
              <label className="mb-1 block text-[0.82rem] font-semibold text-[#5c6b62]">Accredited programme</label>
              <select
                id="tertiary_programme"
                disabled={!tertiaryInstitutionId}
                value={tertiaryProgrammeKey}
                onChange={(e) => setTertiaryProgrammeKey(e.target.value)}
                className="w-full rounded-[10px] border border-[#dcd3c2] bg-white p-2.5 font-inherit disabled:opacity-60"
              >
                <option value="">{tertiaryInstitutionId ? "Select programme…" : "Select an institution first"}</option>
                {sortedProgrammeEntries.map(({ p, originalIndex }) => (
                  <option key={programmeComboKey(tertiaryInstitutionId, originalIndex)} value={programmeComboKey(tertiaryInstitutionId, originalIndex)}>
                    {p.name}
                    {p.duration_years != null ? ` (${p.duration_years} yr)` : ""}
                    {p.status && p.status !== "Active" ? ` — ${p.status}` : ""}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-sm text-[#5c6b62]">
                Data merged from GTEC per-institution exports ({gtec.file_count} files, generated{" "}
                {new Date(gtec.generated_at).toLocaleDateString()}). Colleges of Education, nursing schools, and similar
                appear if you pick <strong>Other / not listed</strong> at step 1 — full lists for those sit in the same
                dataset for future use.
              </p>
            </StepBlock>
          )}

          {step === 1 &&
            educationLevel &&
            !["shs", "university", "technical_university"].includes(educationLevel) && (
              <StepBlock title="Programme (if it applies)">
                <p className="text-sm text-[#5c6b62]">
                  This step is mainly for SHS, university, and technical university learners. Tap <strong>Next</strong> to
                  continue.
                </p>
              </StepBlock>
            )}

          {step === 2 && (
            <StepBlock title="What do you want to work on most?">
              {err2 && <p className="mb-3 text-sm text-[#a61f3b]">Pick a focus (or Other).</p>}
              <p className="mb-2 text-sm text-[#5c6b62]">{subjectFocusHint(educationLevel, shsTrack)}</p>
              <label className="mb-1 block text-[0.82rem] font-semibold text-[#5c6b62]">Subject or theme</label>
              <select
                value={subjectFocus}
                onChange={(e) => setSubjectFocus(e.target.value)}
                className="w-full rounded-[10px] border border-[#dcd3c2] bg-white p-2.5 font-inherit"
              >
                {subjectOptions.map((o, i) => (
                  <option key={o.value || `sub-${i}`} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </StepBlock>
          )}

          {step === 3 && (
            <StepBlock title="Region (optional)">
              <label className="mb-1 block text-[0.82rem] font-semibold text-[#5c6b62]">Helps with localized examples</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full rounded-[10px] border border-[#dcd3c2] bg-white p-2.5 font-inherit"
              >
                <option value="">Prefer not to say</option>
                {[
                  "Greater Accra",
                  "Ashanti",
                  "Western",
                  "Western North",
                  "Central",
                  "Eastern",
                  "Volta",
                  "Oti",
                  "Northern",
                  "Savannah",
                  "North East",
                  "Upper East",
                  "Upper West",
                  "Bono",
                  "Bono East",
                  "Ahafo",
                ].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </StepBlock>
          )}

          {step === 4 && (
            <StepBlock title="Goals in your own words">
              <label className="mb-1 block text-[0.82rem] font-semibold text-[#5c6b62]">
                What should the coach prioritise? (optional)
              </label>
              <textarea
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                placeholder="e.g. Pass Core Math, understand MoMo scams, revision plan for WASSCE…"
                rows={4}
                className="w-full resize-y rounded-[10px] border border-[#dcd3c2] bg-white p-2.5 font-inherit"
              />
            </StepBlock>
          )}

          <div className="mt-4 flex justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              className={`rounded-xl border border-[#dcd3c2] bg-transparent px-4 py-2.5 font-[family-name:var(--font-syne)] text-sm font-bold text-[#5c6b62] ${step === 0 ? "invisible" : ""}`}
            >
              Back
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={!!tertiaryNeedsData && !gtec && !gtecErr}
              className="rounded-xl bg-[#1b3d30] px-4 py-2.5 font-[family-name:var(--font-syne)] text-sm font-bold text-[#e8f2ec] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {step === STEPS - 1 ? "Open my chat" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 font-[family-name:var(--font-syne)] text-base font-bold text-[#1b3d30]">{title}</h2>
      {children}
    </div>
  );
}

function subjectFocusHint(level: string | null, track: string): string {
  if (!level) return "Choices update based on your level and programme.";
  if (level === "primary_jhs") return "Aligned to basic school & BECE-style priorities.";
  if (level === "shs" && track)
    return `Options reflect SHS — ${track.replace(/_/g, " ")} track and common electives.`;
  if (level === "shs") return "Pick your SHS track on the previous step to tailor this list.";
  if (level === "university")
    return "Options reflect your selected university programme plus general degree skills.";
  if (level === "technical_university")
    return "Options reflect your technical programme plus applied / industry-relevant study.";
  if (level === "educator_parent") return "Focused on supporting learners and understanding Ghana’s school system.";
  return "Broad themes — say more in Goals or in chat.";
}
