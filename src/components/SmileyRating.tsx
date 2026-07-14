"use client";

/**
 * Real smiley-face rating control, matching the original AirCare Challenge
 * reference material (the Clean & Care Challenge poster/form screenshots
 * showed literal smiley faces, not an abstract gauge). Used for all 4
 * feedback dimensions required by the AirCare doc.
 */
export type RatingValue = "SATISFIED" | "NEUTRAL" | "NOT_SATISFIED";

function SmileyIcon({ type, active }: { type: RatingValue; active: boolean }) {
  const color = active
    ? { SATISFIED: "#1b8a5a", NEUTRAL: "#c98a12", NOT_SATISFIED: "#d64545" }[type]
    : "#C7CEDA";

  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <circle cx="18" cy="18" r="17" stroke={color} strokeWidth={active ? 2.5 : 1.5} fill={active ? `${color}1A` : "transparent"} />
      <circle cx="13" cy="15" r="1.8" fill={color} />
      <circle cx="23" cy="15" r="1.8" fill={color} />
      {type === "SATISFIED" && (
        <path d="M11 21 Q18 27 25 21" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
      )}
      {type === "NEUTRAL" && (
        <line x1="11" y1="22" x2="25" y2="22" stroke={color} strokeWidth="2" strokeLinecap="round" />
      )}
      {type === "NOT_SATISFIED" && (
        <path d="M11 24 Q18 18 25 24" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
      )}
    </svg>
  );
}

const OPTIONS: { value: RatingValue; label: string; hint: string }[] = [
  { value: "NOT_SATISFIED", label: "Not satisfied", hint: "Needs attention" },
  { value: "NEUTRAL", label: "Neutral", hint: "Could be better" },
  { value: "SATISFIED", label: "Satisfied", hint: "Looks good" },
];

export function SmileyRating({
  question,
  value,
  onChange,
}: {
  question: string;
  value: RatingValue | null;
  onChange: (v: RatingValue) => void;
}) {
  return (
    <div>
      <div className="text-sm font-medium mb-3" style={{ color: "var(--color-navy)" }}>
        {question}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="flex min-h-28 flex-col items-center gap-2 rounded-2xl border px-3 py-3 text-center transition"
            style={{
              backgroundColor: value === opt.value ? "var(--color-orange-soft)" : "rgba(255,255,255,0.75)",
              borderColor: value === opt.value ? "var(--color-orange)" : "var(--color-border)",
              boxShadow: value === opt.value ? "0 12px 28px rgba(242, 107, 33, 0.12)" : "none",
            }}
            aria-pressed={value === opt.value}
            aria-label={`${question}: ${opt.label}`}
          >
            <SmileyIcon type={opt.value} active={value === opt.value} />
            <div>
              <div className="text-xs font-semibold" style={{ color: "var(--color-navy)" }}>
                {opt.label}
              </div>
              <div className="text-[10px] leading-tight mt-1" style={{ color: "var(--color-muted)" }}>
                {opt.hint}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
