import { useId } from "react";

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  disabled?: boolean;
  /** Marks this as the field that should receive focus on mount. */
  autoFocus?: boolean;
}

/** A labelled numeric text field with inline validation messaging. */
export function OperandInput({
  label,
  value,
  onChange,
  error,
  disabled = false,
  autoFocus = false,
}: Props) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="operand">
      <label className="operand__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={error ? "operand__input operand__input--invalid" : "operand__input"}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        // Autofocus is appropriate here: the operand field is the page's
        // primary control and there is nothing above it to skip past.
        autoFocus={autoFocus}
        value={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? (
        <p className="operand__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
