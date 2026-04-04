"use client";

type Props = {
  value: string;
  onChange(s: string): void;
  onAppendFromAssistant(text: string): void;
  lastAssistantText: string | null;
};

export function StudioEditorPanel({ value, onChange, onAppendFromAssistant, lastAssistantText }: Props) {
  return (
    <aside className="flex w-full max-w-md shrink-0 flex-col border-l border-sc-line bg-sc-elev lg:max-w-[380px]">
      <div className="flex items-center justify-between border-b border-sc-line px-4 py-3">
        <div>
          <h2 className="font-[family-name:var(--font-syne)] text-sm font-bold text-white">Scratch pad</h2>
          <p className="text-xs text-[#8c9a90]">Local only — not saved to the server yet.</p>
        </div>
      </div>
      {lastAssistantText && (
        <div className="border-b border-sc-line px-4 py-2">
          <button
            type="button"
            onClick={() => onAppendFromAssistant(lastAssistantText)}
            className="w-full rounded-xl border border-sc-gold/35 bg-sc-bg px-3 py-2 text-xs font-semibold text-sc-gold hover:border-sc-gold/55 hover:bg-sc-line/40"
          >
            Add last reply to editor
          </button>
        </div>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste or refine coach output here…"
        className="min-h-0 flex-1 resize-none border-0 bg-sc-bg p-4 text-sm leading-relaxed text-sc-mist placeholder:text-[#6a756d] focus:outline-none focus:ring-0"
        spellCheck
      />
    </aside>
  );
}
