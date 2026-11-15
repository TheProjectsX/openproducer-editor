export function ProcessingProgress({ label, value }: { label: string; value?: number | null }) {
  const determinate = typeof value === "number" && Number.isFinite(value);
  const percentage = determinate ? Math.max(0, Math.min(100, Math.round(value))) : 0;
  return <div className="processing-progress-wrap" role="status" aria-live="polite">
    <div className="processing-progress-label"><span>{label}</span>{determinate && <strong>{percentage}%</strong>}</div>
    <div className={`processing-progress-track${determinate ? " determinate" : " indeterminate"}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={determinate ? percentage : undefined}>
      <span style={determinate ? { width: `${percentage}%` } : undefined} />
    </div>
  </div>;
}
