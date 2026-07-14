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

const OPTIONS: { value: RatingValue; label: string }[] = [
  { value: "NOT_SATISFIED", label: "Not Satisfied" },
  { value: "NEUTRAL", label: "Neutral" },
  { value: "SATISFIED", label: "Satisfied" },
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
      <div className="text-sm font-medium mb-2" style={{ color: "var(--color-navy)" }}>
        {question}
      </div>
      <div className="flex gap-3 justify-center">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="flex flex-col items-center gap-1 rounded-lg px-2 py-1.5 transition"
            style={{
              backgroundColor: value === opt.value ? "var(--color-orange-soft)" : "transparent",
            }}
            aria-pressed={value === opt.value}
          >
            <SmileyIcon type={opt.value} active={value === opt.value} />
            <span className="text-[10px]" style={{ color: "var(--color-muted)" }}>
              {opt.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
