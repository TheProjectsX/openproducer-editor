import { useEffect, useState } from "react";

export function ImageNumberInput({
  label,
  value,
  min,
  max,
  step = "any",
  unit,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: string;
  unit: string;
  onCommit: (value: number) => void;
}) {
  const formatted = Number(value.toFixed(3));
  const [draft, setDraft] = useState(String(formatted));
  useEffect(() => setDraft(String(formatted)), [formatted]);

  function commit() {
    const number = Number(draft);
    if (draft.trim() && Number.isFinite(number)) {
      onCommit(Math.max(min, Math.min(max, number)));
    } else {
      setDraft(String(formatted));
    }
  }

  return (
    <label className="speed-field">
      {label} <span>{unit}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </label>
  );
}
