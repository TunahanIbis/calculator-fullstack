import { OPERATIONS, type OperationId } from "../domain/operations";

interface Props {
  value: OperationId;
  onChange: (id: OperationId) => void;
  disabled?: boolean;
}

/**
 * A segmented control for choosing the arithmetic operation. Implemented as a
 * radio group so it is keyboard- and screen-reader-friendly.
 */
export function OperationPicker({ value, onChange, disabled = false }: Props) {
  return (
    <div
      className="operation-picker"
      role="radiogroup"
      aria-label="Operation"
    >
      {OPERATIONS.map((op) => {
        const selected = op.id === value;
        return (
          <button
            key={op.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={op.label}
            title={op.hint}
            className={selected ? "op-button op-button--active" : "op-button"}
            disabled={disabled}
            onClick={() => onChange(op.id)}
          >
            <span className="op-button__symbol" aria-hidden="true">
              {op.symbol}
            </span>
            <span className="op-button__label">{op.label}</span>
          </button>
        );
      })}
    </div>
  );
}
