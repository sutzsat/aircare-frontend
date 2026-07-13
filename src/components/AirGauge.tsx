"use client";

/**
 * Signature element (Phase 6 design system): an air-pressure-gauge dial,
 * used for both the rating selector and any score display, tying the visual
 * identity directly to "Free Air Facility" rather than a generic icon set.
 */
export function AirGauge({
  value,
  size = 96,
}: {
  value: number;
  size?: number;
}) {
  const angle = -120 + (value / 100) * 240;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 10;

  const arcPoint = (deg: number, radius: number): [number, number] => {
    const rad = (deg - 90) * (Math.PI / 180);
    return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
  };
  const describeArc = (startDeg: number, endDeg: number, radius: number) => {
    const [x1, y1] = arcPoint(startDeg, radius);
    const [x2, y2] = arcPoint(endDeg, radius);
    const large = endDeg - startDeg <= 180 ? 0 : 1;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
  };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <path d={describeArc(-120, -40, r)} stroke="#d64545" strokeWidth="8" fill="none" strokeLinecap="round" opacity={0.85} />
      <path d={describeArc(-40, 40, r)} stroke="#c98a12" strokeWidth="8" fill="none" strokeLinecap="round" opacity={0.85} />
      <path d={describeArc(40, 120, r)} stroke="#1b8a5a" strokeWidth="8" fill="none" strokeLinecap="round" opacity={0.85} />
      <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: "transform 0.3s ease" }}>
        <line x1={cx} y1={cy} x2={cx} y2={cy - r + 6} stroke="#0b1f3f" strokeWidth="3" strokeLinecap="round" />
      </g>
      <circle cx={cx} cy={cy} r="5" fill="#0b1f3f" />
    </svg>
  );
}
