interface Props {
  /** Big line: current number or result. */
  value: string;
  /** Small line: the expression being built. */
  expression: string;
  /** When set, shown in place of the value. */
  error: string | null;
  busy: boolean;
}

/** The calculator's screen: a faint expression line above a large value line. */
export function Display({ value, expression, error, busy }: Props) {
  return (
    <output
      className={error ? "display display--error" : "display"}
      aria-label="Display"
      aria-live="polite"
    >
      <span className="display__expression">{error ? "" : expression}</span>
      <span
        className="display__value"
        // Re-key on change so the value animates in.
        key={error ?? value}
        data-busy={busy || undefined}
      >
        {error ?? value}
      </span>
    </output>
  );
}
